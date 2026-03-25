#!/usr/bin/env node

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 高级功能 Node.js 应用 - JWT 身份认证系统
 * 功能：
 * 1. 用户注册和登录
 * 2. JWT Token 生成和验证
 * 3. 密码加密（使用 crypto 模块）
 * 4. 认证中间件
 * 5. 受保护的 API 端点
 * 6. Token 刷新机制
 */

// ==================== 配置 ====================
const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: 3600, // 1小时（秒）
  REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 3600, // 7天（秒）
  SALT_ROUNDS: 10,
  PORT: process.env.PORT || 4000,
  HOST: '0.0.0.0'
};

// ==================== 数据存储 ====================
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'auth-users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'refresh-tokens.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化用户数据
let users = [];
let refreshTokens = [];

// 加载用户数据
function loadUsers() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(data);
    } catch (error) {
      console.error('读取用户数据失败:', error.message);
      users = [];
    }
  }
}

// 保存用户数据
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (error) {
    console.error('保存用户数据失败:', error.message);
  }
}

// 加载刷新令牌
function loadRefreshTokens() {
  if (fs.existsSync(TOKENS_FILE)) {
    try {
      const data = fs.readFileSync(TOKENS_FILE, 'utf8');
      refreshTokens = JSON.parse(data);
    } catch (error) {
      console.error('读取刷新令牌失败:', error.message);
      refreshTokens = [];
    }
  }
}

// 保存刷新令牌
function saveRefreshTokens() {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(refreshTokens, null, 2), 'utf8');
  } catch (error) {
    console.error('保存刷新令牌失败:', error.message);
  }
}

// 初始化数据
loadUsers();
loadRefreshTokens();

// ==================== 密码加密工具 ====================

// 使用 PBKDF2 加密密码（Node.js 原生，无需 bcrypt）
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// 验证密码
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// ==================== JWT 工具函数 ====================

// Base64URL 编码
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Base64URL 解码
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString();
}

// 生成 JWT Token
function generateToken(payload, expiresIn = CONFIG.JWT_EXPIRES_IN) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));

  const signature = crypto
    .createHmac('sha256', CONFIG.JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// 验证 JWT Token
function verifyToken(token) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new Error('Invalid token format');
    }

    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', CONFIG.JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    // 解码 payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 生成刷新令牌
function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== 认证中间件 ====================

async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: '缺少认证令牌' };
  }

  const token = authHeader.substring(7);
  const result = verifyToken(token);

  if (!result.valid) {
    return { authenticated: false, error: result.error };
  }

  return { authenticated: true, user: result.payload };
}

// ==================== 工具函数 ====================

// 解析 JSON 请求体
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('无效的 JSON 格式'));
      }
    });
    req.on('error', reject);
  });
}

// 发送 JSON 响应
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

// 发送 HTML 响应
function sendHTML(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(html);
}

// ==================== 验证工具 ====================

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  // 至少 6 个字符
  if (password.length < 6) {
    return { valid: false, message: '密码至少需要 6 个字符' };
  }
  return { valid: true };
}

// ==================== API 路由处理 ====================

// POST /api/auth/register - 用户注册
async function handleRegister(req, res) {
  try {
    const body = await parseBody(req);
    const { username, email, password, name } = body;

    // 验证必填字段
    if (!username || !email || !password) {
      sendJSON(res, 400, {
        success: false,
        message: '缺少必填字段：username, email, password'
      });
      return;
    }

    // 验证邮箱格式
    if (!validateEmail(email)) {
      sendJSON(res, 400, {
        success: false,
        message: '邮箱格式不正确'
      });
      return;
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      sendJSON(res, 400, {
        success: false,
        message: passwordValidation.message
      });
      return;
    }

    // 检查用户名是否已存在
    if (users.find(u => u.username === username)) {
      sendJSON(res, 400, {
        success: false,
        message: '用户名已被使用'
      });
      return;
    }

    // 检查邮箱是否已存在
    if (users.find(u => u.email === email)) {
      sendJSON(res, 400, {
        success: false,
        message: '邮箱已被使用'
      });
      return;
    }

    // 创建新用户
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username,
      email,
      name: name || username,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
      role: 'user'
    };

    users.push(newUser);
    saveUsers();

    // 生成 Token
    const token = generateToken({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    });

    const refreshToken = generateRefreshToken();
    refreshTokens.push({
      token: refreshToken,
      userId: newUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRES_IN * 1000).toISOString()
    });
    saveRefreshTokens();

    sendJSON(res, 201, {
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        },
        token,
        refreshToken,
        expiresIn: CONFIG.JWT_EXPIRES_IN
      }
    });
  } catch (error) {
    sendJSON(res, 400, {
      success: false,
      message: error.message
    });
  }
}

// POST /api/auth/login - 用户登录
async function handleLogin(req, res) {
  try {
    const body = await parseBody(req);
    const { username, password } = body;

    // 验证必填字段
    if (!username || !password) {
      sendJSON(res, 400, {
        success: false,
        message: '缺少必填字段：username, password'
      });
      return;
    }

    // 查找用户
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) {
      sendJSON(res, 401, {
        success: false,
        message: '用户名或密码错误'
      });
      return;
    }

    // 验证密码
    if (!verifyPassword(password, user.password)) {
      sendJSON(res, 401, {
        success: false,
        message: '用户名或密码错误'
      });
      return;
    }

    // 生成 Token
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });

    const refreshToken = generateRefreshToken();
    refreshTokens.push({
      token: refreshToken,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRES_IN * 1000).toISOString()
    });
    saveRefreshTokens();

    sendJSON(res, 200, {
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken,
        expiresIn: CONFIG.JWT_EXPIRES_IN
      }
    });
  } catch (error) {
    sendJSON(res, 400, {
      success: false,
      message: error.message
    });
  }
}

// POST /api/auth/refresh - 刷新 Token
async function handleRefreshToken(req, res) {
  try {
    const body = await parseBody(req);
    const { refreshToken } = body;

    if (!refreshToken) {
      sendJSON(res, 400, {
        success: false,
        message: '缺少刷新令牌'
      });
      return;
    }

    // 查找刷新令牌
    const tokenData = refreshTokens.find(t => t.token === refreshToken);
    if (!tokenData) {
      sendJSON(res, 401, {
        success: false,
        message: '无效的刷新令牌'
      });
      return;
    }

    // 检查是否过期
    if (new Date(tokenData.expiresAt) < new Date()) {
      sendJSON(res, 401, {
        success: false,
        message: '刷新令牌已过期'
      });
      return;
    }

    // 查找用户
    const user = users.find(u => u.id === tokenData.userId);
    if (!user) {
      sendJSON(res, 401, {
        success: false,
        message: '用户不存在'
      });
      return;
    }

    // 生成新的访问令牌
    const newToken = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });

    sendJSON(res, 200, {
      success: true,
      message: '令牌刷新成功',
      data: {
        token: newToken,
        expiresIn: CONFIG.JWT_EXPIRES_IN
      }
    });
  } catch (error) {
    sendJSON(res, 400, {
      success: false,
      message: error.message
    });
  }
}

// POST /api/auth/logout - 用户登出
async function handleLogout(req, res) {
  try {
    const body = await parseBody(req);
    const { refreshToken } = body;

    if (refreshToken) {
      // 删除刷新令牌
      refreshTokens = refreshTokens.filter(t => t.token !== refreshToken);
      saveRefreshTokens();
    }

    sendJSON(res, 200, {
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    sendJSON(res, 400, {
      success: false,
      message: error.message
    });
  }
}

// GET /api/auth/me - 获取当前用户信息（受保护）
async function handleGetMe(req, res) {
  const auth = await authenticateRequest(req);

  if (!auth.authenticated) {
    sendJSON(res, 401, {
      success: false,
      message: auth.error || '未授权'
    });
    return;
  }

  const user = users.find(u => u.id === auth.user.id);
  if (!user) {
    sendJSON(res, 404, {
      success: false,
      message: '用户不存在'
    });
    return;
  }

  sendJSON(res, 200, {
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    }
  });
}

// GET /api/protected/users - 获取所有用户（受保护，仅管理员）
async function handleGetAllUsers(req, res) {
  const auth = await authenticateRequest(req);

  if (!auth.authenticated) {
    sendJSON(res, 401, {
      success: false,
      message: auth.error || '未授权'
    });
    return;
  }

  // 检查权限
  if (auth.user.role !== 'admin') {
    sendJSON(res, 403, {
      success: false,
      message: '权限不足'
    });
    return;
  }

  const sanitizedUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt
  }));

  sendJSON(res, 200, {
    success: true,
    count: sanitizedUsers.length,
    data: sanitizedUsers
  });
}

// ==================== 主页 HTML ====================
function getHomePage() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Node.js JWT 认证系统</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 15px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 2.5em;
    }
    .subtitle {
      color: #888;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    .section {
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
      border-left: 4px solid #667eea;
    }
    h2 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 1.5em;
    }
    .feature {
      background: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .api-list {
      list-style: none;
    }
    .api-item {
      background: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .method {
      font-weight: bold;
      padding: 5px 10px;
      border-radius: 5px;
      margin-right: 15px;
      min-width: 70px;
      text-align: center;
      font-size: 0.9em;
    }
    .get { background: #61affe; color: white; }
    .post { background: #49cc90; color: white; }
    .endpoint {
      font-family: 'Courier New', monospace;
      color: #333;
      flex: 1;
    }
    .protected {
      background: #ffc107;
      color: #333;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      margin-left: 10px;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 10px 0;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: #888;
      font-size: 0.9em;
    }
    .badge {
      background: #667eea;
      color: white;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Node.js JWT 认证系统</h1>
    <p class="subtitle">完整的身份认证与授权解决方案</p>

    <div class="section">
      <h2>✨ 核心功能</h2>
      <div class="feature">
        <strong>🔑 JWT 认证</strong> - 基于 JSON Web Token 的无状态认证
      </div>
      <div class="feature">
        <strong>🔒 密码加密</strong> - 使用 PBKDF2 算法安全存储密码
      </div>
      <div class="feature">
        <strong>🔄 Token 刷新</strong> - 支持访问令牌和刷新令牌机制
      </div>
      <div class="feature">
        <strong>🛡️ 权限控制</strong> - 基于角色的访问控制（RBAC）
      </div>
      <div class="feature">
        <strong>✅ 数据验证</strong> - 邮箱格式、密码强度等完整验证
      </div>
    </div>

    <div class="section">
      <h2>🔌 API 端点</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/register</span>
          <span class="badge">公开</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/login</span>
          <span class="badge">公开</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/refresh</span>
          <span class="badge">公开</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/logout</span>
          <span class="badge">公开</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/auth/me</span>
          <span class="protected">🔒 需要认证</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/protected/users</span>
          <span class="protected">🔒 需要管理员权限</span>
        </li>
      </ul>
    </div>

    <div class="section">
      <h2>🧪 快速测试</h2>

      <h3 style="margin: 15px 0 10px;">1. 注册新用户</h3>
      <pre>curl -X POST http://localhost:4000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'</pre>

      <h3 style="margin: 15px 0 10px;">2. 用户登录</h3>
      <pre>curl -X POST http://localhost:4000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "testuser",
    "password": "password123"
  }'</pre>

      <h3 style="margin: 15px 0 10px;">3. 访问受保护的端点</h3>
      <pre>curl http://localhost:4000/api/auth/me \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"</pre>

      <h3 style="margin: 15px 0 10px;">4. 刷新 Token</h3>
      <pre>curl -X POST http://localhost:4000/api/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
  }'</pre>
    </div>

    <div class="section">
      <h2>📋 响应格式</h2>
      <h3 style="margin: 15px 0 10px;">成功登录响应示例：</h3>
      <pre>{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "name": "Test User",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "a1b2c3d4e5f6...",
    "expiresIn": 3600
  }
}</pre>
    </div>

    <div class="section">
      <h2>🔧 技术特点</h2>
      <div class="feature">
        ✅ <strong>零依赖</strong> - 仅使用 Node.js 原生模块
      </div>
      <div class="feature">
        ✅ <strong>安全</strong> - PBKDF2 密码加密 + HMAC-SHA256 签名
      </div>
      <div class="feature">
        ✅ <strong>标准化</strong> - 完全符合 JWT 标准（RFC 7519）
      </div>
      <div class="feature">
        ✅ <strong>生产就绪</strong> - 包含完整的错误处理和验证
      </div>
    </div>

    <div class="footer">
      <p>💻 使用 Node.js 原生模块构建 | 无需外部依赖</p>
      <p>端口: 4000 | 数据文件: data/auth-users.json</p>
      <p style="margin-top: 10px; color: #f93e3e;">
        <strong>⚠️ 安全提示：</strong> 请在生产环境中修改 JWT_SECRET 环境变量
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ==================== HTTP 服务器 ====================
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`[${new Date().toLocaleTimeString('zh-CN')}] ${method} ${pathname}`);

  // 处理 CORS 预检请求
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // 路由处理
  try {
    // 主页
    if (pathname === '/' && method === 'GET') {
      sendHTML(res, 200, getHomePage());
      return;
    }

    // 认证 API 路由
    if (pathname === '/api/auth/register' && method === 'POST') {
      await handleRegister(req, res);
      return;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      await handleLogin(req, res);
      return;
    }

    if (pathname === '/api/auth/refresh' && method === 'POST') {
      await handleRefreshToken(req, res);
      return;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      await handleLogout(req, res);
      return;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      await handleGetMe(req, res);
      return;
    }

    // 受保护的 API 路由
    if (pathname === '/api/protected/users' && method === 'GET') {
      await handleGetAllUsers(req, res);
      return;
    }

    // 404
    sendJSON(res, 404, {
      success: false,
      message: '未找到该端点'
    });
  } catch (error) {
    console.error('服务器错误:', error);
    sendJSON(res, 500, {
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// ==================== 启动服务器 ====================
server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🔐 JWT 认证服务器已启动！                           ║
║                                                       ║
║   📍 地址: http://localhost:${CONFIG.PORT}                      ║
║   🔑 认证: http://localhost:${CONFIG.PORT}/api/auth/login      ║
║                                                       ║
║   按 Ctrl+C 停止服务器                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
  console.log(`✅ 服务器运行在 http://localhost:${CONFIG.PORT}`);
  console.log(`📁 用户数据: ${USERS_FILE}`);
  console.log(`👥 当前用户数: ${users.length}`);
  console.log(`🔑 JWT 过期时间: ${CONFIG.JWT_EXPIRES_IN} 秒\n`);
  console.log(`⚠️  生产环境请设置环境变量 JWT_SECRET\n`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n⏹  收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n⏹  收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

module.exports = { server, generateToken, verifyToken };
