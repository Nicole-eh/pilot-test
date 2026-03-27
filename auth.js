#!/usr/bin/env node

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JsonStore = require('./store');
const path = require('path');
const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} = require('./lib/errors');

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
const CONFIG = {
  // JWT 密钥（生产环境应放在环境变量中）
  JWT_SECRET: process.env.JWT_SECRET || 'my-super-secret-key-change-in-production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'my-refresh-secret-key-change-in-production',

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
const revokedTokens = new Set();

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
      return { valid: false, error: 'Token 已被撤销' };
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
 * 成功返回用户信息，失败直接抛出 AuthenticationError
 *
 * @param {http.IncomingMessage} req
 * @returns {object} 解码后的用户信息 { id, username, role }
 * @throws {AuthenticationError}
 */
function authenticate(req) {
  const token = extractToken(req);
  if (!token) {
    throw new AuthenticationError('未提供认证 Token，请在 Header 中添加: Authorization: Bearer <token>');
  }

  const result = verifyAccessToken(token);
  if (!result.valid) {
    throw new AuthenticationError(result.error);
  }

  return result.decoded;
}

/**
 * 角色授权检查：验证用户是否具有指定角色
 * 失败直接抛出 AuthorizationError
 *
 * @param {object} user - 从 Token 解析出的用户信息
 * @param  {...string} allowedRoles - 允许的角色列表
 * @throws {AuthorizationError}
 */
function authorize(user, ...allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `权限不足：需要 [${allowedRoles.join(', ')}] 角色，当前角色为 [${user.role}]`
    );
  }
}

// ==================== 业务逻辑 ====================

/**
 * 用户注册
 * @throws {ValidationError} 参数不合法
 * @throws {ConflictError} 用户名已存在
 */
async function register(username, password, role) {
  // 验证输入
  if (!username || !password) {
    throw new ValidationError('用户名和密码为必填项');
  }

  if (username.length < 3 || username.length > 20) {
    throw new ValidationError('用户名长度需在 3-20 个字符之间');
  }

  if (password.length < 6) {
    throw new ValidationError('密码长度不能少于 6 个字符');
  }

  // 检查用户名是否已存在
  const existing = accountStore.getAll().find(a => a.username === username);
  if (existing) {
    throw new ConflictError('该用户名已被注册');
  }

  // 确定角色（只允许 admin 和 user）
  const validRole = (role === CONFIG.ROLES.ADMIN) ? CONFIG.ROLES.ADMIN : CONFIG.ROLES.USER;

  // 加密密码
  const hashedPassword = await hashPassword(password);

  // 创建账号
  const account = accountStore.create({
    username,
    password: hashedPassword,
    role: validRole
  });

  // 返回时不暴露密码
  return { id: account.id, username: account.username, role: account.role, createdAt: account.createdAt };
}

/**
 * 用户登录
 * @throws {ValidationError} 缺少参数
 * @throws {AuthenticationError} 用户名或密码错误
 */
async function login(username, password) {
  if (!username || !password) {
    throw new ValidationError('用户名和密码为必填项');
  }

  // 查找用户
  const account = accountStore.getAll().find(a => a.username === username);
  if (!account) {
    throw new AuthenticationError('用户名或密码错误');
  }

  // 验证密码
  const isMatch = await comparePassword(password, account.password);
  if (!isMatch) {
    throw new AuthenticationError('用户名或密码错误');
  }

  // 签发双 Token
  const accessToken = generateAccessToken(account);
  const refreshToken = generateRefreshToken(account);

  return {
    user: { id: account.id, username: account.username, role: account.role },
    accessToken,
    refreshToken,
    expiresIn: CONFIG.ACCESS_TOKEN_EXPIRES
  };
}

/**
 * 刷新 Access Token
 * @throws {ValidationError} 缺少 Refresh Token
 * @throws {AuthenticationError} Token 无效或用户不存在
 */
function refresh(refreshToken) {
  if (!refreshToken) {
    throw new ValidationError('请提供 Refresh Token');
  }

  const result = verifyRefreshToken(refreshToken);
  if (!result.valid) {
    throw new AuthenticationError(result.error);
  }

  // 查找用户（确保用户仍然存在）
  const account = accountStore.getById(result.decoded.id);
  if (!account) {
    throw new AuthenticationError('用户不存在');
  }

  // 撤销旧的 Refresh Token
  revokedTokens.add(result.decoded.jti);

  // 签发新的双 Token
  const newAccessToken = generateAccessToken(account);
  const newRefreshToken = generateRefreshToken(account);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: CONFIG.ACCESS_TOKEN_EXPIRES
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
      revokedTokens.add(decoded.jti);
    }
  } catch (_) {
    // Token 已失效，无需撤销
  }

  return { success: true, status: 200, message: '已退出登录，Token 已撤销' };
}

/**
 * 获取当前用户信息（需已认证）
 * @throws {NotFoundError} 用户不存在
 */
function getProfile(userId) {
  const account = accountStore.getById(userId);
  if (!account) {
    throw new NotFoundError('用户', userId);
  }
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    createdAt: account.createdAt
  };
}

/**
 * 获取所有账号列表（仅 admin）
 */
function getAllAccounts() {
  return accountStore.getAll().map(a => ({
    id: a.id,
    username: a.username,
    role: a.role,
    createdAt: a.createdAt
  }));
}

/**
 * 删除账号（仅 admin）
 * @throws {ValidationError} 不能删除自己
 * @throws {NotFoundError} 账号不存在
 */
function deleteAccount(targetId, currentUserId) {
  if (parseInt(targetId) === currentUserId) {
    throw new ValidationError('不能删除自己的账号');
  }
  const deleted = accountStore.delete(targetId);
  if (!deleted) {
    throw new NotFoundError('账号', targetId);
  }
  return { id: deleted.id, username: deleted.username };
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
