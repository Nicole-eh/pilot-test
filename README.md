# Node.js 学习项目 🚀

从初级到高级的 Node.js 完整学习项目，包含命令行工具、HTTP 服务器、RESTful API 和 JWT 身份认证。

> 📌 **适合人群**：有基本 JavaScript 基础，想系统学习 Node.js 后端开发的中文开发者。

---

## 📚 项目概览

本项目分为 **三个阶段**，由浅入深地覆盖 Node.js 后端开发的核心知识：

| 阶段 | 文件 | 内容 | 难度 |
|------|------|------|------|
| 🌱 初级 | `index.js` | 命令行工具：问候、日志、TODO、计算器 | ⭐ |
| 🚀 中级 | `server.js` | 原生 HTTP 服务器 + RESTful API | ⭐⭐ |
| 🔐 高级 | `auth.js` | JWT 身份认证 + 角色权限控制 (RBAC) | ⭐⭐⭐ |

---

## 🎯 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 14.0.0
- npm（随 Node.js 一起安装）

### 安装

```bash
# 克隆项目
git clone https://github.com/Nicole-eh/pilot-test.git
cd pilot-test

# 安装依赖（JWT 和 bcrypt）
npm install
```

### 运行

```bash
# 初级功能 — 命令行工具
node index.js help

# 中级 + 高级功能 — 启动 HTTP 服务器（含 API 和 JWT 认证）
npm run server
# 然后在浏览器打开 http://localhost:3000
```

---

## 📂 项目结构

```
pilot-test/
├── index.js                 # 🌱 初级功能 — 命令行工具入口
├── server.js                # 🚀 中级功能 — HTTP 服务器 + RESTful API
├── auth.js                  # 🔐 高级功能 — JWT 认证模块
├── store.js                 # 📦 通用 JSON 文件存储模块
├── package.json             # 项目配置和依赖声明
├── .gitignore               # Git 忽略规则
├── README.md                # 项目说明（本文件）
├── 初级功能说明.md           # 初级功能详细文档
├── 中级功能说明.md           # 中级功能详细文档
├── 高级功能说明.md           # 高级功能详细文档
├── test-api.sh              # 用户 CRUD API 自动化测试脚本
├── test-auth.sh             # JWT 认证 API 自动化测试脚本
├── log.txt                  # 日志文件（运行初级功能后自动生成）
└── data/                    # 数据存储目录（自动生成）
    ├── users.json           # 用户数据
    ├── todos.json           # 待办事项数据
    └── accounts.json        # 认证账号数据
```

---

## 🌱 第一阶段：初级功能 (`index.js`)

通过命令行工具学习 Node.js 基础：`process.argv`、文件读写、模块化。

### 功能列表

| 功能 | 说明 | 学习要点 |
|------|------|---------|
| 问候 | 命令行参数处理，支持中英文名字 | `process.argv` |
| 日志 | 写入 / 读取 `log.txt` | `fs.appendFileSync`、`fs.readFileSync` |
| 待办事项 | TODO 增删改查 | JSON 持久化、CRUD 模式 |
| 计算器 | 加减乘除，支持中文命令 | `parseFloat`、`switch...case`、输入验证 |

### 使用示例

```bash
# 问候
node index.js 小明                    # → 你好, 小明! 👋
node index.js Alice                   # → 你好, Alice! 👋

# 日志
node index.js log 今天学习了 Node.js  # 写入日志
node index.js logs                    # 查看所有日志

# 待办事项
node index.js todo add 学习Node       # 添加待办
node index.js todo list               # 查看所有待办
node index.js todo done 1             # 标记 #1 完成
node index.js todo undone 1           # 标记 #1 未完成
node index.js todo remove 1           # 删除 #1

# 计算器（英文 / 中文均可）
node index.js add 5 3                 # → 5 + 3 = 8
node index.js 加 5 3                  # → 5 + 3 = 8
node index.js subtract 10 4           # → 10 - 4 = 6
node index.js multiply 6 7            # → 6 × 7 = 42
node index.js divide 20 4             # → 20 ÷ 4 = 5

# 查看帮助
node index.js help
```

> 📖 详细文档：[初级功能说明](./初级功能说明.md)

---

## 🚀 第二阶段：中级功能 (`server.js`)

不依赖 Express，使用 Node.js 原生 `http` 模块构建完整的 Web 服务器和 RESTful API。

### 功能列表

| 功能 | 说明 |
|------|------|
| HTTP 服务器 | 原生 `http.createServer()`，不使用任何框架 |
| 用户 CRUD API | 完整的增删改查 RESTful 接口 |
| TODO API | 通过 HTTP 接口管理待办事项 |
| CSV 导出 | 用户数据转换为 CSV 格式下载 |
| 数据统计 | 平均年龄、最年长 / 最年轻用户等 |
| Web 主页 | 带有实时统计数据的漂亮界面 |
| CORS 支持 | 允许前端跨域访问 |

### 启动服务器

```bash
npm run server
# 或
node server.js
```

服务器将在 http://localhost:3000 启动，打开浏览器即可查看 Web 界面。

### 用户 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/users` | 获取所有用户 |
| `GET` | `/api/users/:id` | 获取单个用户 |
| `POST` | `/api/users` | 创建新用户 |
| `PUT` | `/api/users/:id` | 更新用户 |
| `DELETE` | `/api/users/:id` | 删除用户 |
| `GET` | `/api/stats` | 获取统计信息 |
| `GET` | `/api/users/export/csv` | 导出 CSV 文件 |

### TODO API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/todos` | 获取所有待办 |
| `GET` | `/api/todos/:id` | 获取单个待办 |
| `POST` | `/api/todos` | 创建新待办 |
| `PUT` | `/api/todos/:id` | 更新待办 |
| `DELETE` | `/api/todos/:id` | 删除待办 |

### curl 测试示例

```bash
# 获取所有用户
curl http://localhost:3000/api/users

# 创建新用户
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"王五","email":"wangwu@example.com","age":27}'

# 更新用户
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"张三（更新）","age":26}'

# 删除用户
curl -X DELETE http://localhost:3000/api/users/1

# 获取统计信息
curl http://localhost:3000/api/stats

# 导出 CSV
curl http://localhost:3000/api/users/export/csv -o users.csv

# 创建待办事项
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"学习 Node.js"}'
```

> 📖 详细文档：[中级功能说明](./中级功能说明.md)

---

## 🔐 第三阶段：高级功能 (`auth.js`)

基于 JWT 的完整身份认证系统，包含双 Token 机制和角色权限控制 (RBAC)。

### 功能列表

| 功能 | 说明 |
|------|------|
| 用户注册 | 密码使用 bcrypt（10 轮 salt）加密存储 |
| 用户登录 | 签发 Access Token（15 分钟）+ Refresh Token（7 天） |
| Token 刷新 | 用 Refresh Token 换取新的 Access Token，旧 Token 自动撤销 |
| 中间件鉴权 | 验证请求 Header 中的 `Authorization: Bearer <token>` |
| 角色权限 (RBAC) | `admin`（管理员）和 `user`（普通用户）两种角色 |
| 退出登录 | 撤销 Refresh Token，立即失效 |

### 认证流程

```
客户端                                  服务器
  │                                      │
  │  1. POST /api/auth/register          │
  │  {username, password}                │
  │─────────────────────────────────────→│  bcrypt(password) → 存储
  │                                      │
  │  2. POST /api/auth/login             │
  │  {username, password}                │
  │─────────────────────────────────────→│  验证密码 → 签发双 Token
  │  ←── {accessToken, refreshToken}     │
  │                                      │
  │  3. GET /api/auth/profile            │
  │  Header: Authorization: Bearer <AT>  │
  │─────────────────────────────────────→│  验证 Token → 返回用户信息
  │  ←── {id, username, role}            │
  │                                      │
  │  4. POST /api/auth/refresh           │  （Access Token 过期后）
  │  {refreshToken}                      │
  │─────────────────────────────────────→│  验证 RT → 签发新双 Token
  │  ←── {newAccessToken, newRefreshToken}│  撤销旧 RT
  │                                      │
  │  5. POST /api/auth/logout            │
  │  {refreshToken}                      │
  │─────────────────────────────────────→│  撤销 Refresh Token
```

### 认证 API 端点

#### 公开接口（无需 Token）

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 用户注册 |
| `POST` | `/api/auth/login` | 用户登录，返回双 Token |
| `POST` | `/api/auth/refresh` | 刷新 Access Token |
| `POST` | `/api/auth/logout` | 退出登录，撤销 Token |

#### 受保护接口（需要 Bearer Token）

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/auth/profile` | 🔒 user / admin | 获取当前用户信息 |
| `GET` | `/api/auth/accounts` | 🔒👑 admin | 查看所有账号 |
| `DELETE` | `/api/auth/accounts/:id` | 🔒👑 admin | 删除指定账号 |

> 🔒 = 需要 Bearer Token &nbsp;&nbsp; 👑 = 仅管理员

### curl 测试示例

```bash
# 1. 注册普通用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}'

# 2. 注册管理员
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","role":"admin"}'

# 3. 登录（获取 Token）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}'
# 响应中会包含 accessToken 和 refreshToken

# 4. 用 Token 访问受保护接口
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <你的accessToken>"

# 5. 刷新 Token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<你的refreshToken>"}'

# 6. 退出登录
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<你的refreshToken>"}'
```

> 📖 详细文档：[高级功能说明](./高级功能说明.md)

---

## 📦 通用存储模块 (`store.js`)

项目封装了一个通用的 JSON 文件存储类 `JsonStore`，被 `index.js`、`server.js`、`auth.js` 共同使用。

### 特性

- **安全写入**：先写入临时文件（`.tmp`）再原子重命名，防止写入中途崩溃导致数据损坏
- **自动 ID 生成**：每条记录自动分配递增 ID
- **自动时间戳**：创建时自动添加 `createdAt`，更新时自动添加 `updatedAt`
- **完整 CRUD**：`getAll()`、`getById(id)`、`create(record)`、`update(id, updates)`、`delete(id)`

### 使用示例

```javascript
const JsonStore = require('./store');

const store = new JsonStore('./data/items.json');

// 创建
const item = store.create({ name: '示例', value: 42 });
// → { id: 1, name: '示例', value: 42, createdAt: '2026-03-27T...' }

// 读取
store.getAll();       // 获取所有记录
store.getById(1);     // 根据 ID 获取

// 更新
store.update(1, { value: 100 });

// 删除
store.delete(1);
```

---

## 🧪 自动化测试

项目提供了两个 Shell 测试脚本，可以一键验证所有 API 功能：

```bash
# 先启动服务器
npm run server

# 新开终端，运行 API 测试（用户 CRUD + TODO）
bash test-api.sh

# 运行认证测试（注册 → 登录 → 鉴权 → 刷新 → 角色权限 → 退出）
bash test-auth.sh
```

`test-auth.sh` 覆盖了完整的 12 步认证流程测试：

1. 注册普通用户
2. 注册管理员
3. 重复注册（验证失败）
4. 密码过短（验证失败）
5. 普通用户登录
6. 错误密码登录（验证失败）
7. 无 Token 访问受保护接口（验证 401）
8. 携带 Token 访问 profile（验证成功）
9. 刷新 Token
10. 普通用户访问 admin 接口（验证 403）
11. admin 查看所有账号（验证成功）
12. 退出登录（撤销 Token）

---

## 🎓 学习路线

### 第一阶段：Node.js 基础 ⭐

1. Node.js 运行环境和 REPL
2. 命令行参数处理（`process.argv`）
3. 文件系统操作（`fs` 模块）
4. 路径处理（`path` 模块）
5. 模块化（`require` / `module.exports`）
6. 错误处理（`try...catch`）

### 第二阶段：HTTP 与 API ⭐⭐

1. HTTP 协议基础（方法、状态码、Header）
2. 原生 HTTP 服务器（`http.createServer()`）
3. URL 路由与正则匹配
4. RESTful API 设计原则
5. JSON 数据序列化 / 反序列化
6. 异步编程（Promise、async/await）
7. 数据持久化（文件存储）
8. CORS 跨域处理

### 第三阶段：认证与安全 ⭐⭐⭐

1. 密码安全（bcrypt 哈希加密）
2. JWT 原理（Header.Payload.Signature）
3. 双 Token 机制（Access Token + Refresh Token）
4. 中间件模式（认证 → 授权 → 业务逻辑）
5. 角色权限控制（RBAC）
6. Token 撤销与安全退出

---

## 💡 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | JavaScript (Node.js) |
| 核心模块 | `http`、`fs`、`path`、`url`、`crypto` |
| 外部依赖 | [`jsonwebtoken`](https://www.npmjs.com/package/jsonwebtoken)（JWT 签发与验证）、[`bcryptjs`](https://www.npmjs.com/package/bcryptjs)（密码加密） |
| 数据存储 | JSON 文件（通过 `store.js` 通用模块） |
| API 风格 | RESTful |
| 认证方式 | JWT Bearer Token |

---

## 🌟 项目特色

- ✨ **中文友好** — 所有文档、代码注释、错误提示均为中文，命令行支持中文命令
- ✨ **循序渐进** — 从命令行工具 → HTTP 服务器 → JWT 认证，难度逐步提升
- ✨ **深入原理** — 不依赖 Express 等框架，使用原生模块理解底层机制
- ✨ **安全写入** — `store.js` 采用临时文件 + 原子重命名策略，避免数据损坏
- ✨ **配套完善** — 每个阶段都有详细说明文档和自动化测试脚本
- ✨ **代码清晰** — 完善的函数注释、清晰的模块划分、统一的错误处理

---

## 📊 全部 API 端点一览

启动服务器后，以下所有端点均可使用：

### 用户管理

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/` | Web 主页（带实时统计） |
| `GET` | `/api/users` | 获取所有用户 |
| `GET` | `/api/users/:id` | 获取单个用户 |
| `POST` | `/api/users` | 创建新用户 |
| `PUT` | `/api/users/:id` | 更新用户 |
| `DELETE` | `/api/users/:id` | 删除用户 |
| `GET` | `/api/stats` | 获取统计信息 |
| `GET` | `/api/users/export/csv` | 导出 CSV 文件 |

### 待办事项

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/todos` | 获取所有待办 |
| `GET` | `/api/todos/:id` | 获取单个待办 |
| `POST` | `/api/todos` | 创建新待办 |
| `PUT` | `/api/todos/:id` | 更新待办 |
| `DELETE` | `/api/todos/:id` | 删除待办 |

### 身份认证

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/register` | 公开 | 用户注册 |
| `POST` | `/api/auth/login` | 公开 | 用户登录 |
| `POST` | `/api/auth/refresh` | 公开 | 刷新 Token |
| `POST` | `/api/auth/logout` | 公开 | 退出登录 |
| `GET` | `/api/auth/profile` | 🔒 登录用户 | 获取个人信息 |
| `GET` | `/api/auth/accounts` | 🔒 仅 admin | 查看所有账号 |
| `DELETE` | `/api/auth/accounts/:id` | 🔒 仅 admin | 删除指定账号 |

---

## 📖 详细文档

| 文档 | 内容 |
|------|------|
| [初级功能说明](./初级功能说明.md) | 命令行工具开发、文件 I/O、代码结构详解 |
| [中级功能说明](./中级功能说明.md) | HTTP 服务器、RESTful API、数据处理、完整 curl/Fetch/Postman 测试示例 |
| [高级功能说明](./高级功能说明.md) | JWT 原理、双 Token 机制、bcrypt 密码安全、RBAC 角色权限、认证流程图 |

---

## 🎓 学习资源

- [Node.js 官方文档](https://nodejs.org/docs/)
- [JavaScript MDN 教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
- [HTTP 协议详解](https://developer.mozilla.org/zh-CN/docs/Web/HTTP)
- [RESTful API 设计指南](https://restfulapi.net/)
- [JWT 官网（可在线解析 Token）](https://jwt.io/)
- [bcrypt 原理介绍](https://en.wikipedia.org/wiki/Bcrypt)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📝 许可证

ISC License

---

**快乐学习！Happy Coding! 🎉**
