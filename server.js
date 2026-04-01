#!/usr/bin/env node

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const JsonStore = require('./store');
const auth = require('./auth');
const { MiddlewareEngine, loggerMiddleware, corsMiddleware, bodyParserMiddleware, errorHandlerMiddleware } = require('./middleware');
const { Router } = require('./router');

/**
 * Node.js 应用 - HTTP 服务器 + RESTful API + JWT 认证
 *
 * 架构：中间件引擎 + 路由器
 *   MiddlewareEngine（管道）
 *     → loggerMiddleware（日志）
 *     → corsMiddleware（跨域）
 *     → bodyParserMiddleware（JSON 解析）
 *     → Router（路由分发）
 *     → errorHandlerMiddleware（错误处理）
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

// ==================== 工具函数 ====================

// 发送 JSON 响应
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
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

// 发送 CSV 响应
function sendCSV(res, statusCode, csv, filename) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`
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

// ==================== TODO 数据存储 ====================
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const todoStore = new JsonStore(TODOS_FILE);

// ==================== 认证辅助中间件 ====================

/**
 * 要求认证的中间件：验证 Token 后挂载 req.user
 * 用于保护需要登录才能访问的路由
 */
function requireAuth(req, res, next) {
  const authResult = auth.authenticate(req);
  if (!authResult.authenticated) {
    sendJSON(res, 401, { success: false, message: authResult.error });
    return;
  }
  req.user = authResult.user;
  next();
}

/**
 * 要求 admin 角色的中间件（需要先经过 requireAuth）
 */
function requireAdmin(req, res, next) {
  const authzResult = auth.authorize(req.user, 'admin');
  if (!authzResult.authorized) {
    sendJSON(res, 403, { success: false, message: authzResult.error });
    return;
  }
  next();
}

// ==================== 路由定义 ====================

// --- 用户 CRUD 路由 ---
const userRouter = new Router();

// GET /users — 获取所有用户
userRouter.get('/users', (req, res) => {
  sendJSON(res, 200, {
    success: true,
    count: users.length,
    data: users
  });
});

// GET /users/export/csv — 导出 CSV（必须放在 /users/:id 前面）
userRouter.get('/users/export/csv', (req, res) => {
  const csv = usersToCSV();
  sendCSV(res, 200, csv, 'users.csv');
});

// GET /users/:id — 获取单个用户
userRouter.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${req.params.id} 的用户`
    });
    return;
  }
  sendJSON(res, 200, { success: true, data: user });
});

// POST /users — 创建新用户
userRouter.post('/users', (req, res) => {
  const body = req.body;

  if (!body.name || !body.email) {
    sendJSON(res, 400, {
      success: false,
      message: '缺少必填字段：name 和 email'
    });
    return;
  }

  if (users.find(u => u.email === body.email)) {
    sendJSON(res, 400, {
      success: false,
      message: '该邮箱已被使用'
    });
    return;
  }

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
});

// PUT /users/:id — 更新用户
userRouter.put('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${req.params.id} 的用户`
    });
    return;
  }

  const body = req.body;
  const updatedUser = {
    ...users[userIndex],
    name: body.name || users[userIndex].name,
    email: body.email || users[userIndex].email,
    age: body.age !== undefined ? body.age : users[userIndex].age,
    updatedAt: new Date().toISOString()
  };

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
});

// DELETE /users/:id — 删除用户
userRouter.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${req.params.id} 的用户`
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
});

// GET /stats — 统计信息
userRouter.get('/stats', (req, res) => {
  const stats = getStatistics();
  sendJSON(res, 200, { success: true, data: stats });
});

// --- TODO 路由 ---
const todoRouter = new Router();

// GET /todos
todoRouter.get('/todos', (req, res) => {
  const todos = todoStore.getAll();
  sendJSON(res, 200, {
    success: true,
    count: todos.length,
    data: todos
  });
});

// GET /todos/:id
todoRouter.get('/todos/:id', (req, res) => {
  const todo = todoStore.getById(req.params.id);
  if (!todo) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${req.params.id} 的待办事项`
    });
    return;
  }
  sendJSON(res, 200, { success: true, data: todo });
});

// POST /todos
todoRouter.post('/todos', (req, res) => {
  const body = req.body;
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
});

// PUT /todos/:id
todoRouter.put('/todos/:id', (req, res) => {
  const existing = todoStore.getById(req.params.id);
  if (!existing) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${req.params.id} 的待办事项`
    });
    return;
  }
  const body = req.body;
  const updates = {};
  if (body.text !== undefined) updates.text = body.text.trim();
  if (body.done !== undefined) updates.done = Boolean(body.done);

  const updated = todoStore.update(req.params.id, updates);
  sendJSON(res, 200, {
    success: true,
    message: '待办事项更新成功',
    data: updated
  });
});

// DELETE /todos/:id
todoRouter.delete('/todos/:id', (req, res) => {
  const deleted = todoStore.delete(req.params.id);
  if (!deleted) {
    sendJSON(res, 404, {
      success: false,
      message: `未找到 ID 为 ${req.params.id} 的待办事项`
    });
    return;
  }
  sendJSON(res, 200, {
    success: true,
    message: '待办事项删除成功',
    data: deleted
  });
});

// --- 认证路由 ---
const authRouter = new Router();

// POST /auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const body = req.body;
    const result = await auth.register(body.username, body.password, body.role);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message,
      data: result.data || undefined
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
});

// POST /auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const body = req.body;
    const result = await auth.login(body.username, body.password);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message,
      data: result.data || undefined
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
});

// POST /auth/refresh
authRouter.post('/refresh', (req, res) => {
  try {
    const body = req.body;
    const result = auth.refresh(body.refreshToken);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message,
      data: result.data || undefined
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
});

// POST /auth/logout
authRouter.post('/logout', (req, res) => {
  try {
    const body = req.body;
    const result = auth.logout(body.refreshToken);
    sendJSON(res, result.status, {
      success: result.success,
      message: result.message
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, message: error.message });
  }
});

// GET /auth/profile (需认证)
authRouter.get('/profile', (req, res) => {
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
});

// GET /auth/accounts (仅 admin)
authRouter.get('/accounts', (req, res) => {
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
  const result = auth.getAllAccounts();
  sendJSON(res, result.status, {
    success: result.success,
    count: result.data ? result.data.length : 0,
    data: result.data
  });
});

// DELETE /auth/accounts/:id (仅 admin)
authRouter.delete('/accounts/:id', (req, res) => {
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
  const result = auth.deleteAccount(req.params.id, authResult.user.id);
  sendJSON(res, result.status, {
    success: result.success,
    message: result.message,
    data: result.data || undefined
  });
});

// --- 主路由器：组合所有子路由 ---
const apiRouter = new Router();
apiRouter.mount('/auth', authRouter);

// 将 userRouter 和 todoRouter 的路由合并到 apiRouter
// （它们的路由路径已经包含 /users、/todos 前缀）
for (const route of userRouter.routes) {
  apiRouter._addRoute(route.method, route.pattern, route.handler);
}
for (const route of todoRouter.routes) {
  apiRouter._addRoute(route.method, route.pattern, route.handler);
}

// ==================== 组装中间件引擎 ====================
const app = new MiddlewareEngine();

// 1. URL 解析中间件：设置 req.pathname 和 req.query
app.use((req, res, next) => {
  const parsedUrl = url.parse(req.url, true);
  req.pathname = parsedUrl.pathname;
  req.query = parsedUrl.query;
  next();
});

// 2. 日志中间件
app.use(loggerMiddleware());

// 3. CORS 中间件
app.use(corsMiddleware());

// 4. 主页路由（在 bodyParser 之前，GET 不需要解析 body）
app.use((req, res, next) => {
  if (req.pathname === '/' && req.method === 'GET') {
    sendHTML(res, 200, getHomePage());
    return;
  }
  next();
});

// 5. JSON Body 解析中间件（仅对 /api 路径生效）
app.use('/api', bodyParserMiddleware());

// 6. API 路由中间件
app.use('/api', (req, res, next) => {
  const pathname = req.pathname;
  // 剥离 /api 前缀后交给路由器
  const apiPath = pathname.slice(4) || '/';

  if (apiRouter.handle(req.method, apiPath, req, res)) {
    return; // 路由已处理
  }

  // API 404
  sendJSON(res, 404, {
    success: false,
    message: '未找到该 API 端点'
  });
});

// 7. 通用 404 页面
app.use((req, res, next) => {
  sendHTML(res, 404, `
    <html>
      <head><title>404 Not Found</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>404 - 页面未找到</h1>
        <p><a href="/" style="color: #667eea;">返回主页</a></p>
      </body>
    </html>
  `);
});

// 8. 错误处理中间件（必须放在最后）
app.use(errorHandlerMiddleware());

// ==================== 主页 HTML ====================
function getHomePage() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Node.js 学习项目 - HTTP 服务器 & RESTful API & JWT 认证</title>
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
    <h1>Node.js 全功能演示</h1>
    <p class="subtitle">HTTP 服务器 + RESTful API + JWT 认证 + 中间件引擎 + 路由器</p>

    <div class="section">
      <h2>服务器状态</h2>
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
          <div class="stat-value">OK</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>RESTful API 端点</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/users</span>
          <span class="description">获取所有用户</span>
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

      <h2 style="margin-top:25px;">TODO API 端点</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/todos</span>
          <span class="description">获取所有待办</span>
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
      <h2>认证 API 端点 (JWT)</h2>
      <ul class="api-list">
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/register</span>
          <span class="description">用户注册</span>
        </li>
        <li class="api-item">
          <span class="method post">POST</span>
          <span class="endpoint">/api/auth/login</span>
          <span class="description">��户登录（获取 Token）</span>
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
          <span class="description">获取个人信息（需认证）</span>
        </li>
        <li class="api-item">
          <span class="method get">GET</span>
          <span class="endpoint">/api/auth/accounts</span>
          <span class="description">所有账号（仅 admin）</span>
        </li>
        <li class="api-item">
          <span class="method delete">DELETE</span>
          <span class="endpoint">/api/auth/accounts/:id</span>
          <span class="description">删除账号（仅 admin）</span>
        </li>
      </ul>
      <p style="margin-top:10px;color:#888;font-size:0.85em;">
        需认证接口需要 Bearer Token; 管理接口仅管理员可用
      </p>
    </div>

    <div class="section">
      <h2>快速测试</h2>
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
      </div>
      <div style="margin-top: 15px;">
        <a href="/api/users" class="button">查看用户数据</a>
        <a href="/api/stats" class="button">查看统计信息</a>
        <a href="/api/users/export/csv" class="button">导出 CSV</a>
      </div>
    </div>

    <div class="section">
      <h2>架构说明</h2>
      <div style="background: white; padding: 15px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 0.85em; line-height: 1.8;">
        请求 → URL解析 → 日志 → CORS → BodyParser → Router → 响应<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ (出错时)<br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ErrorHandler → 错误响应
      </div>
    </div>

    <div class="footer">
      <p>Node.js + 中间件引擎 + 路由器 + JWT</p>
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
const server = http.createServer((req, res) => {
  app.run(req, res, (err) => {
    // 如果所有中间件都没有处理（不应该发生，因为有 404 中间件兜底）
    if (err) {
      console.error('未捕获的服务器错误:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '服务器内部错误' }));
      }
    }
  });
});

// ==================== 启动服务器 ====================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
+-------------------------------------------------------+
|                                                       |
|   Node.js HTTP 服务器已启动！                         |
|                                                       |
|   地址: http://localhost:${PORT}                         |
|   API:  http://localhost:${PORT}/api/users               |
|                                                       |
|   架构: MiddlewareEngine + Router                     |
|   中间件: Logger → CORS → BodyParser → Router         |
|                                                       |
|   按 Ctrl+C 停止服务器                                |
|                                                       |
+-------------------------------------------------------+
  `);
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`数据文件: ${USERS_FILE}`);
  console.log(`当前用户数: ${users.length}\n`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

module.exports = { server, app, apiRouter, userRouter, todoRouter, authRouter };
