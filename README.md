# Node.js 学习项目 🚀

从初级到高级的 Node.js 完整学习项目，包含命令行工具、HTTP 服务器、RESTful API、TODO 管理和 JWT 身份验证。

## 📚 项目概览

这个项目分为三个层级，循序渐进地学习 Node.js 开发：

### 🌱 初级功能 (index.js)
- ✅ 命令行参数处理
- ✅ 文件读写（日志系统）
- ✅ 简单计算器（支持中文命令）
- ✅ TODO 待办事项管理（CLI）

### 🔥 中级功能 (server.js + store.js)
- ✅ HTTP Web 服务器
- ✅ RESTful API（用户 CRUD + TODO CRUD）
- ✅ 通用 JSON 文件存储模块（JsonStore）
- ✅ JSON 数据处理 & CSV 数据导出
- ✅ 数据统计分析
- ✅ 漂亮的 Web 界面

### 🛡️ 高级功能 (auth.js)
- ✅ JWT 身份验证（双 Token 机制）
- ✅ 用户注册与登录（bcrypt 密码加密）
- ✅ Token 刷新与撤销
- ✅ 角色权限控制（RBAC：admin / user）

---

## 🎯 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/Nicole-eh/pilot-test.git
cd pilot-test

# 安装依赖（认证功能需要）
npm install
```

### 运行初级功能（CLI）

```bash
# 查看帮助
node index.js help

# 问候功能
node index.js 小明

# 计算器（支持中文命令）
node index.js add 5 3
node index.js 加 5 3

# 日志功能
node index.js log 今天学习了 Node.js
node index.js logs

# TODO 待办管理
node index.js todo add "完成学习计划"
node index.js todo list
node index.js todo done 1
node index.js todo delete 1
```

### 运行中级 & 高级功能（HTTP 服务器）

```bash
# 启动服务器
npm run server
# 或者
node server.js

# 打开浏览器访问
# http://localhost:3000
```

---

## 📂 项目结构

```
pilot-test/
├── index.js              # CLI 入口（问候、计算器、日志、TODO）
├── server.js             # HTTP 服务器 + RESTful API 路由
├── store.js              # 通用 JSON 文件存储模块（JsonStore）
├── auth.js               # JWT 认证模块（注册、登录、RBAC）
├── package.json          # 项目配置与依赖
├── AGENTS.md             # AI 编程代理上下文文档
├── README.md             # 项目说明（本文件）
├── 初级功能说明.md        # 初级功能详细文档
├── 中级功能说明.md        # 中级功能详细文档
├── 高级功能说明.md        # 高级功能（JWT 认证）详细文档
├── test-api.sh           # 用户/TODO API 冒烟测试脚本
├── test-auth.sh          # JWT 认证流程冒烟测试脚本
├── log.txt               # CLI 日志文件（自动生成）
└── data/
    ├── users.json        # 用户数据（服务器首次启动自动生成）
    ├── todos.json        # TODO 数据（JsonStore 管理）
    └── accounts.json     # 认证账号数据（JsonStore 管理）
```

---

## 📊 API 端点总览

### 用户管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取所有用户 |
| GET | `/api/users/:id` | 获取单个用户 |
| POST | `/api/users` | 创建新用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/users/export/csv` | 导出用户 CSV |

### TODO 管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/todos` | 获取所有 TODO |
| GET | `/api/todos/:id` | 获取单个 TODO |
| POST | `/api/todos` | 创建 TODO |
| PUT | `/api/todos/:id` | 更新 TODO |
| DELETE | `/api/todos/:id` | 删除 TODO |

### 身份验证（JWT）

| 方法 | 端点 | 需要认证 | 说明 |
|------|------|----------|------|
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录，返回 Token 对 |
| POST | `/api/auth/refresh` | 否 | 刷新 Access Token |
| POST | `/api/auth/logout` | 否 | 撤销 Refresh Token |
| GET | `/api/auth/profile` | Bearer Token | 获取当前用户信息 |
| GET | `/api/auth/accounts` | 仅管理员 | 查看所有账号 |
| DELETE | `/api/auth/accounts/:id` | 仅管理员 | 删除指定账号 |

---

## 🧪 测试 API

### 使用 curl

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
```

### 认证流程

```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}'

# 登录（获取 Token）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}'

# 访问受保护接口（用返回的 accessToken 替换下方占位符）
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <accessToken>"

# 刷新 Token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

### 使用冒烟测试脚本

```bash
# 启动服务器后，在另一个终端运行：
bash test-api.sh      # 测试用户和 TODO 接口
bash test-auth.sh     # 测试认证流程
```

### 使用浏览器

直接访问 http://localhost:3000 查看 Web 界面！

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | HTTP 服务器监听端口 |
| `JWT_SECRET` | `my-super-secret-key-change-in-production` | Access Token 签名密钥 |
| `JWT_REFRESH_SECRET` | `my-refresh-secret-key-change-in-production` | Refresh Token 签名密钥 |

> ⚠️ 生产环境中请务必替换默认密钥！

---

## 💡 技术栈

- **语言**: JavaScript (Node.js)
- **核心模块**: `http`、`fs`、`path`、`url`、`crypto`
- **npm 依赖**:
  - `bcryptjs` — 密码 bcrypt 哈希加密
  - `jsonwebtoken` — JWT 签发与验证
- **数据格式**: JSON、CSV
- **API 风格**: RESTful
- **认证方式**: JWT（双 Token 机制 + RBAC）

---

## 🎓 学习路线

### 第一阶段：初级功能 ✅
1. Node.js 基础语法
2. 命令行参数处理 (`process.argv`)
3. 文件系统操作 (`fs` 模块)
4. 字符串处理和格式化
5. 模块化和导出

### 第二阶段：中级功能 ✅
1. HTTP 服务器 (`http` 模块)
2. URL 路由和参数解析
3. RESTful API 设计
4. JSON 数据处理与持久化
5. 异步编程 (Promise, async/await)
6. 通用存储模块设计 (JsonStore)
7. 错误处理和状态码

### 第三阶段：高级功能 ✅
1. JWT 身份验证（双 Token 机制）
2. 密码安全（bcrypt 哈希）
3. 角色权限控制（RBAC）
4. Token 刷新与撤销
5. 中间件鉴权模式

### 🔮 未来可探索方向
- 数据库集成 (SQLite / MongoDB)
- WebSocket 实时通信
- 单元测试与集成测试
- 部署和 DevOps

---

## 🌟 项目特色

✨ **中文友好** — 完整的中文文档、注释和错误提示
✨ **循序渐进** — 从 CLI 到 HTTP 到 JWT，三阶段层层递进
✨ **原生实现** — 使用 Node.js 内置模块，深入理解底层原理
✨ **代码清晰** — 良好的代码结构、命名和注释
✨ **功能完整** — 涵盖实际开发中的核心功能
✨ **易于扩展** — 模块化设计，方便添加新功能

---

## 📖 详细文档

- [初级功能说明](./初级功能说明.md) — 命令行工具开发
- [中级功能说明](./中级功能说明.md) — HTTP 服务器和 API 开发
- [高级功能说明](./高级功能说明.md) — JWT 认证与权限控制

---

## 🎓 学习资源

- [Node.js 官方文档](https://nodejs.org/docs/)
- [JavaScript 教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
- [HTTP 协议详解](https://developer.mozilla.org/zh-CN/docs/Web/HTTP)
- [RESTful API 设计指南](https://restfulapi.net/)
- [JWT 介绍](https://jwt.io/introduction)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📝 许可证

ISC License

---

**快乐学习！Happy Coding! 🎉**
