#!/usr/bin/env node

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JsonStore = require('./store');
const path = require('path');

/**
 * JWT 认证模块
 *
 * 功能：
 * 1. 用户注册（密码 bcrypt 加密）
 * 2. 用户登录（签发 Access Token + Refresh Token）
 * 3. Token 刷新（用 Refresh Token 换新 Access Token）
 * 4. 中间件鉴权（验证请求中的 Token）
 * 5. 角色权限控制（admin / user）
 */

// ==================== 配置 ====================

// JWT 密钥必须通过环境变量配置，禁止使用硬编码默认值
function requireEnv(name, fallbackForDev) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    console.error(`CRITICAL: Environment variable ${name} is not set. Refusing to start in production with default secrets.`);
    process.exit(1);
  }
  console.warn(`WARNING: ${name} not set. Using insecure default. Set this env var before deploying to production!`);
  return fallbackForDev;
}

const CONFIG = {
  // JWT 密钥（必须通过环境变量设置，生产环境缺失时拒绝启动）
  JWT_SECRET: requireEnv('JWT_SECRET', 'dev-only-jwt-secret-do-not-use-in-prod-' + crypto.randomUUID()),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-do-not-use-in-prod-' + crypto.randomUUID()),

  // Token 过期时间
  ACCESS_TOKEN_EXPIRES: '15m',   // Access Token 15 分钟过期
  REFRESH_TOKEN_EXPIRES: '7d',   // Refresh Token 7 天过期

  // 密码加密轮数
  BCRYPT_ROUNDS: 10,

  // 角色定义
  ROLES: {
    ADMIN: 'admin',
    USER: 'user'
  }
};

// ==================== 账号数据存储 ====================
const ACCOUNTS_FILE = path.join(__dirname, 'data', 'accounts.json');
const accountStore = new JsonStore(ACCOUNTS_FILE);

// 存储已撤销的 Refresh Token（生产环境应使用 Redis）
// 使用 Map 存储 jti -> 过期时间，允许定期清理已过期的条目，防止内存泄漏
const revokedTokens = new Map();

// 定期清理过期的撤销记录（每 30 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of revokedTokens) {
    if (expiresAt < now) {
      revokedTokens.delete(jti);
    }
  }
}, 30 * 60 * 1000).unref();

// ==================== 工具函数 ====================

/**
 * 对密码进行 bcrypt 哈希加密
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, CONFIG.BCRYPT_ROUNDS);
}

/**
 * 验证密码是否与哈希匹配
 */
async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * 签发 Access Token（短期，用于 API 鉴权）
 */
function generateAccessToken(account) {
  const payload = {
    id: account.id,
    username: account.username,
    role: account.role,
    type: 'access'
  };
  return jwt.sign(payload, CONFIG.JWT_SECRET, {
    expiresIn: CONFIG.ACCESS_TOKEN_EXPIRES
  });
}

/**
 * 签发 Refresh Token（长期，用于刷新 Access Token）
 */
function generateRefreshToken(account) {
  const payload = {
    id: account.id,
    username: account.username,
    type: 'refresh',
    // 添加随机 jti 以支持单独撤销
    jti: crypto.randomUUID()
  };
  return jwt.sign(payload, CONFIG.JWT_REFRESH_SECRET, {
    expiresIn: CONFIG.REFRESH_TOKEN_EXPIRES
  });
}

/**
 * 验证 Access Token
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
    if (decoded.type !== 'access') {
      return { valid: false, error: 'Token 类型错误' };
    }
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token 已过期，请刷新或重新登录' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Token 无效' };
    }
    return { valid: false, error: '认证失败' };
  }
}

/**
 * 验证 Refresh Token
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      return { valid: false, error: 'Token 类型错误' };
    }
    // 检查是否已被撤销
    if (revokedTokens.has(decoded.jti)) {
      const expiresAt = revokedTokens.get(decoded.jti);
      if (expiresAt > Date.now()) {
        return { valid: false, error: 'Token 已被撤销' };
      }
      // 已过期的撤销记录，清理掉
      revokedTokens.delete(decoded.jti);
    }
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Refresh Token 已过期，请重新登录' };
    }
    return { valid: false, error: 'Refresh Token 无效' };
  }
}

/**
 * 从请求头中提取 Bearer Token
 * 格式：Authorization: Bearer <token>
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

// ==================== 认证中间件 ====================

/**
 * 鉴权中间件：验证请求是否携带有效的 Access Token
 * 成功后将用户信息挂载到 req.user
 */
function authenticate(req) {
  const token = extractToken(req);
  if (!token) {
    return { authenticated: false, error: '未提供认证 Token，请在 Header 中添加: Authorization: Bearer <token>' };
  }

  const result = verifyAccessToken(token);
  if (!result.valid) {
    return { authenticated: false, error: result.error };
  }

  return { authenticated: true, user: result.decoded };
}

/**
 * 角色授权检查：验证用户是否具有指定角色
 * @param {object} user - 从 Token 解析出的用户信息
 * @param  {...string} allowedRoles - 允许的角色列表
 */
function authorize(user, ...allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      error: `权限不足：需要 [${allowedRoles.join(', ')}] 角色，当前角色为 [${user.role}]`
    };
  }
  return { authorized: true };
}

// ==================== 业务逻辑 ====================

/**
 * 用户注册
 */
async function register(username, password, role) {
  // 验证输入
  if (!username || !password) {
    return { success: false, status: 400, message: '用户名和密码为必填项' };
  }

  if (username.length < 3 || username.length > 20) {
    return { success: false, status: 400, message: '用户名长度需在 3-20 个字符之间' };
  }

  if (password.length < 6) {
    return { success: false, status: 400, message: '密码长度不能少于 6 个字符' };
  }

  // 密码复杂度验证：至少包含大写字母、小写字母和数字
  if (!/[A-Z]/.test(password)) {
    return { success: false, status: 400, message: '密码必须包含至少一个大写字母' };
  }
  if (!/[a-z]/.test(password)) {
    return { success: false, status: 400, message: '密码必须包含至少一个小写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { success: false, status: 400, message: '密码必须包含至少一个数字' };
  }

  // 检查用户名是否已存在
  const existing = accountStore.getAll().find(a => a.username === username);
  if (existing) {
    return { success: false, status: 409, message: '该用户名已被注册' };
  }

  // 安全：注册接口始终分配 user 角色，防止权限提升攻击
  // 管理员账号需要通过其他安全途径创建（如数据库直接操作或专用管理接口）
  if (role === CONFIG.ROLES.ADMIN) {
    console.warn(`WARNING: Registration attempt with admin role for username "${username}" was blocked.`);
  }
  const validRole = CONFIG.ROLES.USER;

  // 加密密码
  const hashedPassword = await hashPassword(password);

  // 创建账号
  const account = accountStore.create({
    username,
    password: hashedPassword,
    role: validRole
  });

  // 返回时不暴露密码
  const safeAccount = { id: account.id, username: account.username, role: account.role, createdAt: account.createdAt };

  return { success: true, status: 201, message: '注册成功', data: safeAccount };
}

/**
 * 用户登录
 */
async function login(username, password) {
  if (!username || !password) {
    return { success: false, status: 400, message: '用户名和密码为必填项' };
  }

  // 查找用户
  const account = accountStore.getAll().find(a => a.username === username);
  if (!account) {
    return { success: false, status: 401, message: '用户名或密码错误' };
  }

  // 验证密码
  const isMatch = await comparePassword(password, account.password);
  if (!isMatch) {
    return { success: false, status: 401, message: '用户名或密码错误' };
  }

  // 签发双 Token
  const accessToken = generateAccessToken(account);
  const refreshToken = generateRefreshToken(account);

  return {
    success: true,
    status: 200,
    message: '登录成功',
    data: {
      user: { id: account.id, username: account.username, role: account.role },
      accessToken,
      refreshToken,
      expiresIn: CONFIG.ACCESS_TOKEN_EXPIRES
    }
  };
}

/**
 * 刷新 Access Token
 */
function refresh(refreshToken) {
  if (!refreshToken) {
    return { success: false, status: 400, message: '请提供 Refresh Token' };
  }

  const result = verifyRefreshToken(refreshToken);
  if (!result.valid) {
    return { success: false, status: 401, message: result.error };
  }

  // 查找用户（确保用户仍然存在）
  const account = accountStore.getById(result.decoded.id);
  if (!account) {
    return { success: false, status: 401, message: '用户不存在' };
  }

  // 撤销旧的 Refresh Token（记录过期时间以便后续清理）
  const tokenExp = result.decoded.exp ? result.decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
  revokedTokens.set(result.decoded.jti, tokenExp);

  // 签发新的双 Token
  const newAccessToken = generateAccessToken(account);
  const newRefreshToken = generateRefreshToken(account);

  return {
    success: true,
    status: 200,
    message: 'Token 刷新成功',
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: CONFIG.ACCESS_TOKEN_EXPIRES
    }
  };
}

/**
 * 退出登录（撤销 Refresh Token）
 */
function logout(refreshToken) {
  if (!refreshToken) {
    return { success: true, status: 200, message: '已退出登录' };
  }

  try {
    const decoded = jwt.verify(refreshToken, CONFIG.JWT_REFRESH_SECRET);
    if (decoded.jti) {
      const tokenExp = decoded.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
      revokedTokens.set(decoded.jti, tokenExp);
    }
  } catch (_) {
    // Token 已失效，无需撤销
  }

  return { success: true, status: 200, message: '已退出登录，Token 已撤销' };
}

/**
 * 获取当前用户信息（需已认证）
 */
function getProfile(userId) {
  const account = accountStore.getById(userId);
  if (!account) {
    return { success: false, status: 404, message: '用户不存在' };
  }
  return {
    success: true,
    status: 200,
    data: {
      id: account.id,
      username: account.username,
      role: account.role,
      createdAt: account.createdAt
    }
  };
}

/**
 * 获取所有账号列表（仅 admin）
 */
function getAllAccounts() {
  const accounts = accountStore.getAll().map(a => ({
    id: a.id,
    username: a.username,
    role: a.role,
    createdAt: a.createdAt
  }));
  return { success: true, status: 200, data: accounts };
}

/**
 * 删除账号（仅 admin）
 */
function deleteAccount(targetId, currentUserId) {
  if (parseInt(targetId) === currentUserId) {
    return { success: false, status: 400, message: '不能删除自己的账号' };
  }
  const deleted = accountStore.delete(targetId);
  if (!deleted) {
    return { success: false, status: 404, message: '账号不存在' };
  }
  return {
    success: true,
    status: 200,
    message: '账号已删除',
    data: { id: deleted.id, username: deleted.username }
  };
}

// ==================== 导出 ====================
module.exports = {
  CONFIG,
  // 认证中间件
  authenticate,
  authorize,
  // 业务逻辑
  register,
  login,
  refresh,
  logout,
  getProfile,
  getAllAccounts,
  deleteAccount
};
