#!/usr/bin/env node

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const JsonStore = require('./store');
const auth = require('./auth');
const { RateLimiter } = require('./rate-limiter');

/**
 * Node.js 应用 - HTTP 服务器 + RESTful API + JWT 认证 + 请求限流
 * 功能：
 * 1. HTTP Web 服务器（静态文件服务）
 * 2. RESTful API（用户 CRUD）
 * 3. JSON 数据处理和 CSV 导出
 * 4. JWT 身份验证 + 角色权限控制
 * 5. 请求限流（Rate Limiting）(NEW!)
 */

// ==================== 数据存储 ====================
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化用户数据
let users = [];
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    users = JSON.parse(data);
  } catch (error) {
    console.error('读取用户数据失败，使用空数组:', error.message);
    users = [];
  }
} else {
  // 创建示例数据
  users = [
    { id: 1, name: '张三', email: 'zhangsan@example.com', age: 25, createdAt: new Date().toISOString() },
    { id: 2, name: '李四', email: 'lisi@example.com', age: 30, createdAt: new Date().toISOString() },
    { id: 3, name: 'Alice', email: 'alice@example.com', age: 28, createdAt: new Date().toISOString() }
  ];
  saveUsers();
}

// 保存用户数据到文件
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (error) {
    console.error('保存用户数据失败:', error.message);
  }
}

// ==================== 请求限流 ====================
const rateLimiter = new RateLimiter({
  // 可通过环境变量调整限流参数
  global: {
    windowMs: 60 * 1000,
    maxHits: parseInt(process.env.RATE_LIMIT_GLOBAL) || 300,
    enabled: true
  },
  perIP: {
    windowMs: 60 * 1000,
    maxHits: parseInt(process.env.RATE_LIMIT_PER_IP) || 60,
    enabled: true
  },
  endpoints: {
    '/api/auth/login': {
      windowMs: 15 * 60 * 1000,
      maxHits: parseInt(process.env.RATE_LIMIT_LOGIN) || 10,
      enabled: true
    },
    '/api/auth/register': {
      windowMs: 60 * 60 * 1000,
      maxHits: parseInt(process.env.RATE_LIMIT_REGISTER) || 5,
      enabled: true
    },
    '/api': {
      windowMs: 60 * 1000,
      maxHits: parseInt(process.env.RATE_LIMIT_API) || 40,
      enabled: true
    }
  },
  whitelist: (process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === 'true'
});

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

// 发送 JSON 响应（支持额外 headers，用于注入限流头等）
function sendJSON(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders
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

// 发送纯文本响应
function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end(text);
}

// 发送 CSV 响应
function sendCSV(res, statusCode, csv, filename) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(csv);
}

// ==================== 数据处理功能 ====================

// 将用户数据转换为 CSV 格式
function usersToCSV() {
  if (users.length === 0) {
    return 'id,name,email,age,createdAt\n';
  }

  const headers = 'id,name,email,age,createdAt\n';
  const rows = users.map(user => {
    return `${user.id},"${user.name}","${user.email}",${user.age},"${user.createdAt}"`;
  }).join('\n');

  return headers + rows;
}

// 统计数据
function getStatistics() {
  if (users.length === 0) {
    return {
      total: 0,
      averageAge: 0,
      oldestUser: null,
      youngestUser: null
    };
  }

  const ages = users.map(u => u.age);
  const total = users.length;
  const averageAge = ages.reduce((sum, age) => sum + age, 0) / total;
  const oldestUser = users.reduce((oldest, user) =>
    user.age > oldest.age ? user : oldest
  );
  const youngestUser = users.reduce((youngest, user) =>
    user.age < youngest.age ? user : youngest
  );

  return {
    total,
    averageAge: Math.round(averageAge * 10) / 10,
    oldestUser: { name: oldestUser.name, age: oldestUser.age },
    youngestUser: { name: youngestUser.name, age: youngestUser.age }
  };
}

// ==================== API 路由处理 ====================

// GET /api/users - 获取所有用户（支持分页/排序/搜索）
// 查询参数：
//   page=1&limit=10          分页
//   sort=age&order=desc      排序
//   search=张                搜索（匹配 name 和 email）
function handleGetUsers(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const options = parseQueryOptions(parsedUrl.query);
  const searchFields = ['name', 'email'];

  const result = applyQuery(users, options, searchFields);

  sendJSON(res, 200, {
    success: true,
    count: result.data.length,
    pagination: result.pagination,
    data: result.data
  });
}

// GET /api/users/:id - 获取单个用户
function handleGetUser(req, res, id) {
  const user = users.find(u => u.id === parseInt(id));
  if (!user) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${id} 的用户`
    });
    return;
  }
  sendJSON(res, 200, {
    success: true,
    data: user
  });
}

// POST /api/users - 创建新用户
async function handleCreateUser(req, res) {
  try {
    const body = await parseBody(req);

    // 验证必填字段
    if (!body.name || !body.email) {
      sendJSON(res, 400, {
        success: false,
        message: '缺少必填字段：name 和 email'
      });
      return;
    }

    // 检查邮箱是否已存在
    if (users.find(u => u.email === body.email)) {
      sendJSON(res, 400, {
        success: false,
        message: '该邮箱已被使用'
      });
      return;
    }

    // 创建新用户
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      name: body.name,
      email: body.email,
      age: body.age || 0,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers();

    sendJSON(res, 201, {
      success: true,
      message: '用户创建成功',
      data: newUser
    });
  } catch (error) {
    sendJSON(res, 400, {
      success: false,
      message: error.message
    });
  }
}

// PUT /api/users/:id - 更新用户
async function handleUpdateUser(req, res, id) {
  try {
    const userId = parseInt(id);
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      sendJSON(res, 404, {
        success: false,
        message: `未找到 ID 为 ${id} 的用户`
      });
      return;
    }

    const body = await parseBody(req);
    const updatedUser = {
      ...users[userIndex],
      name: body.name || users[userIndex].name,
      email: body.email || users[userIndex].email,
      age: body.age !== undefined ? body.age : users[userIndex].age,
      updatedAt: new Date().toISOString()
    };

    // 检查邮箱是否被其他用户使用
    if (body.email && body.email !== users[userIndex].email) {
      if (users.find(u => u.email === body.email && u.id !== userId)) {
        sendJSON(res, 400, {
          success: false,
          message: '该邮箱已被其他用户使用'
        });
        return;
      }
    }

    users[userIndex] = updatedUser;
    saveUsers();

    sendJSON(res, 200, {
      success: true,
      message: '用户更新成功',
      data: updatedUser
    });
  } catch (error) {
    sendJSON(res, 400, {
      success: false,
      message: error.message
    });
  }
}

// DELETE /api/users/:id - 删除用户
function handleDeleteUser(req, res, id) {
  const userId = parseInt(id);
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${id} 的用户`
    });
    return;
  }

  const deletedUser = users.splice(userIndex, 1)[0];
  saveUsers();

  sendJSON(res, 200, {
    success: true,
    message: '用户删除成功',
    data: deletedUser
  });
}

// GET /api/users/export/csv - 导出 CSV
function handleExportCSV(req, res) {
  const csv = usersToCSV();
  sendCSV(res, 200, csv, 'users.csv');
}

// GET /api/stats - 获取统计信息
function handleGetStats(req, res) {
  const stats = getStatistics();
  sendJSON(res, 200, {
    success: true,
    data: stats
  });
}

// ==================== TODO API ====================
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const todoStore = new JsonStore(TODOS_FILE);

// GET /api/todos - 获取所有 TODO（支持分页/排序/搜索）
// 查询参数：
//   page=1&limit=10          分页
//   sort=createdAt&order=desc 排序（支持 text, done, createdAt）
//   search=学习              搜索（匹配 text）
function handleGetTodos(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const options = parseQueryOptions(parsedUrl.query);
  const searchFields = ['text'];

  const todos = todoStore.getAll();
  const result = applyQuery(todos, options, searchFields);

  sendJSON(res, 200, {
    success: true,
    count: result.data.length,
    pagination: result.pagination,
    data: result.data
  });
}

// GET /api/todos/:id - 获取单个 TODO
function handleGetTodo(req, res, id) {
  const todo = todoStore.getById(id);
  if (!todo) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${id} 的待办事项`
    });
    return;
  }
  sendJSON(res, 200, { success: true, data: todo });
}

// POST /api/todos - 创建 TODO
async function handleCreateTodo(req, res) {
  try {
    const body = await parseBody(req);
    if (!body.text || !body.text.trim()) {
      sendJSON(res, 400, {
        success: false,
        message: '缺少必填字段：text'
      });
      return;
    }
    const todo = todoStore.create({
      text: body.text.trim(),
      done: false
    });
    sendJSON(res, 201, {
      success: true,
      message: '待办事项创建成功',
      data: todo
    });
  } catch (error) {
    sendJSON(res, 400, { success: false, message: error.message });
  }
}

// PUT /api/todos/:id - 更新 TODO
async function handleUpdateTodo(req, res, id) {
  try {
    const existing = todoStore.getById(id);
    if (!existing) {
      sendJSON(res, 404, {
        success: false,
        message: `未找到 ID 为 ${id} 的待办事项`
      });
      return;
    }
    const body = await parseBody(req);
    const updates = {};
    if (body.text !== undefined) updates.text = body.text.trim();
    if (body.done !== undefined) updates.done = Boolean(body.done);

    const updated = todoStore.update(id, updates);
    sendJSON(res, 200, {
      success: true,
      message: '待办事项更新成功',
      data: updated
    });
  } catch (error) {
    sendJSON(res, 400, { success: false, message: error.message });
  }
}

// DELETE /api/todos/:id - 删除 TODO
function handleDeleteTodo(req, res, id) {
  const deleted = todoStore.delete(id);
  if (!deleted) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${id} 的待办事项`
    });
    return;
  }
  sendJSON(res, 200, {
    success: true,
    message: '待办事项删除成功',
    data: deleted
  });
}

// ==================== 认证 API ====================

// POST /api/auth/register - 用户注册
async function handleRegister(req, res) {
  try {
    const body = await parseBody(req);
    const result = await auth.register(body.username, body.password, body.role);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message,
      data: result.data || undefined
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
}

// POST /api/auth/login - 用户登录
async function handleLogin(req, res) {
  try {
    const body = await parseBody(req);
    const result = await auth.login(body.username, body.password);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message,
      data: result.data || undefined
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
}

// POST /api/auth/refresh - 刷新 Token
async function handleRefresh(req, res) {
  try {
    const body = await parseBody(req);
    const result = auth.refresh(body.refreshToken);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message,
      data: result.data || undefined
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
}

// POST /api/auth/logout - 退出登录
async function handleLogout(req, res) {
  try {
    const body = await parseBody(req);
    const result = auth.logout(body.refreshToken);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
}

// GET /api/auth/profile - 获取当前用户信息（需认证）
function handleGetProfile(req, res) {
  const authResult = auth.authenticate(req);
  if (!authResult.authenticated) {
    sendJSON(res, 401, { success: false, message: authResult.error });
    return;
  }
  const result = auth.getProfile(authResult.user.id);
  sendJSON(res, result.status, {
    success: result.success,
    data: result.data || undefined,
    message: result.message || undefined
  });
}

// GET /api/auth/accounts - 获取所有账号（仅 admin，支持分页/排序/搜索）
// 查询参数：
//   page=1&limit=10              分页
//   sort=createdAt&order=desc    排序（支持 username, role, createdAt）
//   search=admin                 搜索（匹配 username 和 role）
function handleGetAccounts(req, res) {
  const authResult = auth.authenticate(req);
  if (!authResult.authenticated) {
    sendJSON(res, 401, { success: false, message: authResult.error });
    return;
  }
  const authzResult = auth.authorize(authResult.user, 'admin');
  if (!authzResult.authorized) {
    sendJSON(res, 403, { success: false, message: authzResult.error });
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const options = parseQueryOptions(parsedUrl.query);
  const searchFields = ['username', 'role'];

  const accountResult = auth.getAllAccounts();
  const queryResult = applyQuery(accountResult.data || [], options, searchFields);

  sendJSON(res, accountResult.status, {
    success: accountResult.success,
    count: queryResult.data.length,
    pagination: queryResult.pagination,
    data: queryResult.data
  });
}

// DELETE /api/auth/accounts/:id - 删除账号（仅 admin）
function handleDeleteAccount(req, res, id) {
  const authResult = auth.authenticate(req);
  if (!authResult.authenticated) {
    sendJSON(res, 401, { success: false, message: authResult.error });
    return;
  }
  const authzResult = auth.authorize(authResult.user, 'admin');
  if (!authzResult.authorized) {
    sendJSON(res, 403, { success: false, message: authzResult.error });
    return;
  }
  const result = auth.deleteAccount(id, authResult.user.id);
  sendJSON(res, result.status, {
    success: result.success,
    message: result.message,
    data: result.data || undefined
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
  <title>Node.js 学习项目 - HTTP 服务器 & RESTful API & JWT 认证 & 限流</title>
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
      max-width: 900px;
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
    .put { background: #fca130; color: white; }
    .delete { background: #f93e3e; color: white; }
    .endpoint {
      font-family: 'Courier New', monospace;
      color: #333;
      flex: 1;
    }
    .description {
      color: #888;
      font-size: 0.9em;
      margin-left: auto;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }
    .stat-label {
      color: #888;
      font-size: 0.9em;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      margin: 5px;
      transition: all 0.3s;
    }
    .button:hover {
      background: #764ba2;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: #888;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Node.js 全功能演示</h1>
    <p class="subtitle">HTTP 服务器 + RESTful API + JWT 认证 + 角色权限 + 请求限流</p>

    <div class="section">
      <h2>📊 服务器状态</h2>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">用户总数</div>
          <div class="stat-value" id="total-users">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均年龄</div>
          <div class="stat-value" id="avg-age">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">服务器状态</div>
          <div class="stat-value">✅</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🔌 RESTful API 端点</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/users?page=1&limit=10&sort=age&order=desc&search=张</span>
          <span class="description">获取用户（分页/排序/搜索）</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/users/:id</span>
          <span class="description">获取单个用户</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/users</span>
          <span class="description">创建新用户</span>
        </li>
        <li class="api-item">
          <span class="method put">PUT</span>
          <span class="endpoint">/api/users/:id</span>
          <span class="description">更新用户</span>
        </li>
        <li class="api-item">
          <span class="method delete">DELETE</span>
          <span class="endpoint">/api/users/:id</span>
          <span class="description">删除用户</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/stats</span>
          <span class="description">获取统计信息</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/users/export/csv</span>
          <span class="description">导出 CSV 文件</span>
        </li>
      </ul>

      <h2 style="margin-top:25px;">📝 TODO API 端点</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/todos?page=1&limit=10&sort=createdAt&order=desc&search=学习</span>
          <span class="description">获取待办（分页/排序/搜索）</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/todos/:id</span>
          <span class="description">获取单个待办</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/todos</span>
          <span class="description">创建新待办</span>
        </li>
        <li class="api-item">
          <span class="method put">PUT</span>
          <span class="endpoint">/api/todos/:id</span>
          <span class="description">更新待办</span>
        </li>
        <li class="api-item">
          <span class="method delete">DELETE</span>
          <span class="endpoint">/api/todos/:id</span>
          <span class="description">删除待办</span>
        </li>
      </ul>
    </div>

    <div class="section">
      <h2>🔐 认证 API 端点 (JWT)</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/register</span>
          <span class="description">用户注册</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/login</span>
          <span class="description">用户登录（获取 Token）</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/refresh</span>
          <span class="description">刷新 Access Token</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/logout</span>
          <span class="description">退出登录（撤销 Token）</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/auth/profile</span>
          <span class="description">🔒 获取个人信息</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/auth/accounts</span>
          <span class="description">🔒👑 所有账号（仅 admin）</span>
        </li>
        <li class="api-item">
          <span class="method delete">DELETE</span>
          <span class="endpoint">/api/auth/accounts/:id</span>
          <span class="description">🔒👑 删除账号（仅 admin）</span>
        </li>
      </ul>
      <p style="margin-top:10px;color:#888;font-size:0.85em;">
        🔒 = 需要 Bearer Token &nbsp;&nbsp; 👑 = 仅管理员
      </p>

      <h2 style="margin-top:25px;">🛡 限流 API 端点</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/rate-limit/stats</span>
          <span class="description">🔒👑 查看限流统计</span>
        </li>
      </ul>
      <div style="margin-top:15px;background:white;padding:15px;border-radius:8px;">
        <p style="font-weight:bold;margin-bottom:10px;">限流规则：</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
          <tr style="background:#f0f0f0;">
            <th style="text-align:left;padding:8px;">维度</th>
            <th style="text-align:left;padding:8px;">限制</th>
            <th style="text-align:left;padding:8px;">说明</th>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">全局</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">300 次/分钟</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">所有客户端合计</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">按 IP</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">60 次/分钟</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">每个 IP 独立计数</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">API 接口</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">40 次/分钟</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">/api/* 每个 IP</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">登录</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">10 次/15分钟</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">防暴力破解</td>
          </tr>
          <tr>
            <td style="padding:8px;">注册</td>
            <td style="padding:8px;">5 次/小时</td>
            <td style="padding:8px;">防批量注册</td>
          </tr>
        </table>
        <p style="margin-top:10px;color:#888;font-size:0.85em;">
          所有响应都包含 <code>X-RateLimit-*</code> 响应头，被限流时返回 HTTP 429 + <code>Retry-After</code> 头。
        </p>
      </div>
    </div>

    <div class="section">
      <h2>🔍 分页/排序/搜索</h2>
      <p style="margin-bottom: 15px;">列表接口均支持以下查询参数：</p>
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.95em;">
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;"><code>page</code></td>
            <td style="padding:8px;">页码，从 1 开始（默认 1）</td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;"><code>limit</code></td>
            <td style="padding:8px;">每页条数，1-100（默认 10）</td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;"><code>sort</code></td>
            <td style="padding:8px;">排序字段，如 name, age, createdAt</td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;"><code>order</code></td>
            <td style="padding:8px;">排序方向：asc（升序）或 desc（降序）</td>
          </tr>
          <tr>
            <td style="padding:8px;"><code>search</code></td>
            <td style="padding:8px;">关键字搜索（模糊匹配文本字段）</td>
          </tr>
        </table>
      </div>
      <div style="margin-top: 15px;">
        <a href="/api/users?page=1&limit=2" class="button">分页: 每页2条</a>
        <a href="/api/users?sort=age&order=desc" class="button">按年龄倒序</a>
        <a href="/api/users?search=张" class="button">搜索"张"</a>
      </div>
    </div>

    <div class="section">
      <h2>🧪 快速测试</h2>
      <p style="margin-bottom: 15px;">使用以下命令测试 API：</p>
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <p><strong>1. 注册用户：</strong></p>
        <code>curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"testuser","password":"123456"}'</code>
        <br><br>
        <p><strong>2. 登录获取 Token：</strong></p>
        <code>curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"testuser","password":"123456"}'</code>
        <br><br>
        <p><strong>3. 用 Token 访问受保护接口：</strong></p>
        <code>curl http://localhost:3000/api/auth/profile -H "Authorization: Bearer &lt;你的token&gt;"</code>
        <br><br>
        <p><strong>4. 分页 + 排序 + 搜索：</strong></p>
        <code>curl "http://localhost:3000/api/users?page=1&amp;limit=2&amp;sort=age&amp;order=desc&amp;search=张"</code>
      </div>
      <div style="margin-top: 15px;">
        <a href="/api/users" class="button">查看用户数据</a>
        <a href="/api/stats" class="button">查看统计信息</a>
        <a href="/api/users/export/csv" class="button">导出 CSV</a>
      </div>
    </div>

    <div class="footer">
      <p>💻 Node.js + jsonwebtoken + bcryptjs + rate-limiter</p>
      <p>端口: 3000 | 数据: data/users.json, data/accounts.json</p>
    </div>
  </div>

  <script>
    // 加载统计数据
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          document.getElementById('total-users').textContent = data.data.total;
          document.getElementById('avg-age').textContent = data.data.averageAge;
        }
      })
      .catch(err => console.error('加载统计数据失败:', err));
  </script>
</body>
</html>
  `;
}

// ==================== HTTP 服务器 ====================
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // 请求日志中间件 — 标记开始时间，响应结束时自动记录
  logger.start(req);
  res.on('finish', () => {
    logger.end(req, res);
  });

  // 处理 CORS 预检请求（不计入限流）
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // ---- 请求限流检查 ----
  const clientIP = rateLimiter.getClientIP(req);
  const rateResult = rateLimiter.check(clientIP, pathname);

  // 将限流 headers 注入到所有响应中
  const rlHeaders = rateResult.headers || {};

  if (!rateResult.allowed) {
    const retryAfter = Math.ceil((rateResult.retryAfterMs || 0) / 1000);
    const reasons = {
      global: '服务器请求过多，请稍后再试',
      ip: '您的请求过于频繁，请稍后再试',
      endpoint: `该接口请求过于频繁，请稍后再试`
    };
    console.log(`[限流] ${clientIP} 被拦截 (原因: ${rateResult.reason}, 端点: ${rateResult.endpoint || pathname})`);
    sendJSON(res, 429, {
      success: false,
      message: reasons[rateResult.reason] || '请求过于频繁',
      error: 'Too Many Requests',
      retryAfter: retryAfter,
      limit: rateResult.reason === 'endpoint' ? {
        endpoint: rateResult.endpoint,
        windowSeconds: Math.ceil((rateLimiter.config.endpoints[rateResult.endpoint]?.windowMs || 60000) / 1000)
      } : undefined
    }, rlHeaders);
    return;
  }

  // 将限流 headers 附加到响应（即使没被拦截也返回配额信息）
  for (const [key, value] of Object.entries(rlHeaders)) {
    res.setHeader(key, value);
  }

  // 路由处理
  try {
    // 主页
    if (pathname === '/' && method === 'GET') {
      sendHTML(res, 200, getHomePage());
      return;
    }

    // API 路由
    if (pathname.startsWith('/api')) {

      // ---------- 限流统计路由 ----------
      // GET /api/rate-limit/stats - 查看限流统计信息（仅 admin）
      if (pathname === '/api/rate-limit/stats' && method === 'GET') {
        const authResult = auth.authenticate(req);
        if (!authResult.authenticated) {
          sendJSON(res, 401, { success: false, message: authResult.error });
          return;
        }
        const authzResult = auth.authorize(authResult.user, 'admin');
        if (!authzResult.authorized) {
          sendJSON(res, 403, { success: false, message: authzResult.error });
          return;
        }
        sendJSON(res, 200, {
          success: true,
          data: rateLimiter.getStats()
        });
        return;
      }

      // ---------- 认证路由 ----------
      // POST /api/auth/register
      if (pathname === '/api/auth/register' && method === 'POST') {
        await handleRegister(req, res);
        return;
      }

      // POST /api/auth/login
      if (pathname === '/api/auth/login' && method === 'POST') {
        await handleLogin(req, res);
        return;
      }

      // POST /api/auth/refresh
      if (pathname === '/api/auth/refresh' && method === 'POST') {
        await handleRefresh(req, res);
        return;
      }

      // POST /api/auth/logout
      if (pathname === '/api/auth/logout' && method === 'POST') {
        await handleLogout(req, res);
        return;
      }

      // GET /api/auth/profile (需认证)
      if (pathname === '/api/auth/profile' && method === 'GET') {
        handleGetProfile(req, res);
        return;
      }

      // GET /api/auth/accounts (仅 admin)
      if (pathname === '/api/auth/accounts' && method === 'GET') {
        handleGetAccounts(req, res);
        return;
      }

      // DELETE /api/auth/accounts/:id (仅 admin)
      const accountMatch = pathname.match(/^\/api\/auth\/accounts\/(\d+)$/);
      if (accountMatch && method === 'DELETE') {
        handleDeleteAccount(req, res, accountMatch[1]);
        return;
      }

      // ---------- 用户 CRUD 路由 ----------
      // GET /api/users
      if (pathname === '/api/users' && method === 'GET') {
        handleGetUsers(req, res);
        return;
      }

      // GET /api/stats
      if (pathname === '/api/stats' && method === 'GET') {
        handleGetStats(req, res);
        return;
      }

      // GET /api/users/export/csv
      if (pathname === '/api/users/export/csv' && method === 'GET') {
        handleExportCSV(req, res);
        return;
      }

      // POST /api/users
      if (pathname === '/api/users' && method === 'POST') {
        await handleCreateUser(req, res);
        return;
      }

      // GET /api/users/:id
      const getUserMatch = pathname.match(/^\/api\/users\/(\d+)$/);
      if (getUserMatch && method === 'GET') {
        handleGetUser(req, res, getUserMatch[1]);
        return;
      }

      // PUT /api/users/:id
      if (getUserMatch && method === 'PUT') {
        await handleUpdateUser(req, res, getUserMatch[1]);
        return;
      }

      // DELETE /api/users/:id
      if (getUserMatch && method === 'DELETE') {
        handleDeleteUser(req, res, getUserMatch[1]);
        return;
      }

      // --- TODO API ---
      // GET /api/todos
      if (pathname === '/api/todos' && method === 'GET') {
        handleGetTodos(req, res);
        return;
      }

      // POST /api/todos
      if (pathname === '/api/todos' && method === 'POST') {
        await handleCreateTodo(req, res);
        return;
      }

      // GET/PUT/DELETE /api/todos/:id
      const getTodoMatch = pathname.match(/^\/api\/todos\/(\d+)$/);
      if (getTodoMatch) {
        const todoId = getTodoMatch[1];
        if (method === 'GET') {
          handleGetTodo(req, res, todoId);
          return;
        }
        if (method === 'PUT') {
          await handleUpdateTodo(req, res, todoId);
          return;
        }
        if (method === 'DELETE') {
          handleDeleteTodo(req, res, todoId);
          return;
        }
      }

      // API 404
      sendJSON(res, 404, {
        success: false,
        message: '未找到该 API 端点'
      });
      return;
    }

    // 其他请求 404
    sendHTML(res, 404, `
      <html>
        <head><title>404 Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>404 - 页面未找到</h1>
          <p><a href="/" style="color: #667eea;">返回主页</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error(error, req);
    sendJSON(res, 500, {
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// ==================== 启动服务器 ====================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Node.js HTTP 服务器已启动！                     ║
║                                                       ║
║   📍 地址: http://localhost:${PORT}                      ║
║   📊 API:  http://localhost:${PORT}/api/users            ║
║                                                       ║
║   按 Ctrl+C 停止服务器                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
  console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
  console.log(`📁 数据文件: ${USERS_FILE}`);
  console.log(`👥 当前用户数: ${users.length}`);
  console.log(`🛡  限流已启用: 全局 ${rateLimiter.config.global.maxHits}/min, IP ${rateLimiter.config.perIP.maxHits}/min\n`);
});

// 优雅关闭
function gracefulShutdown(signal) {
  console.log(`\n⏹  收到 ${signal} 信号，正在关闭服务器...`);
  rateLimiter.destroy(); // 清理限流器定时器
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { server };
