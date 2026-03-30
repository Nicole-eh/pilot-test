# Node.js 学习项目 🚀

从初级到高级的 Node.js 完整学习项目，包含命令行工具、HTTP 服务器、RESTful API 和 JWT 身份认证系统。

## 📚 项目概览

这个项目分为三个层级，循序渐进地学习 Node.js 开发：

### 🌱 初级功能 (index.js)
- ✅ 命令行参数处理
- ✅ 文件读写（日志系统）
- ✅ 待办事项管理（TODO）
- ✅ 简单计算器
- ✅ 中文友好的命令行界面

### 🚀 中级功能 (server.js)
- ✅ HTTP Web 服务器
- ✅ RESTful API（用户 CRUD + TODO CRUD）
- ✅ JSON 数据处理与持久化
- ✅ CSV 数据导出
- ✅ 数据统计分析
- ✅ 漂亮的 Web 界面

### 🔐 高级功能 (auth.js)
- ✅ JWT 身份验证（双 Token 机制）
- ✅ 密码 bcrypt 加密存储
- ✅ Access Token + Refresh Token
- ✅ 角色权限控制（admin / user）
- ✅ Token 刷新与撤销
- ✅ 通用 JSON 文件存储模块（store.js）

---

## 🎯 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/Nicole-eh/pilot-test.git
cd pilot-test

# 安装依赖
npm install
```

### 环境变量配置

生产环境下务必设置以下环境变量：

```bash
# .env 示例
PORT=3000                          # 服务器端口（默认 3000）
JWT_SECRET=your-secret-key         # JWT Access Token 密钥
JWT_REFRESH_SECRET=your-refresh-key # JWT Refresh Token 密钥
CORS_ORIGIN=https://yourdomain.com # 允许的 CORS 来源
```

### 运行初级功能

```bash
# 查看帮助
node index.js help

# 问候功能
node index.js 小明

# 计算器
node index.js add 5 3

# 日志功能
node index.js log 今天学习了 Node.js
node index.js logs

# 待办事项
node index.js todo add 学习Node
node index.js todo list
node index.js todo done 1
```

### 运行 HTTP 服务器

```bash
# 启动服务器
npm run server
# 或者
node server.js

# 打开浏览器访问
# http://localhost:3000
```

---

## 📖 详细文档

- [初级功能说明](./初级功能说明.md) - 命令行工具开发
- [中级功能说明](./中级功能说明.md) - HTTP 服务器和 API 开发
- [高级功能说明](./高级功能说明.md) - JWT 认证与权限控制

---

## 📊 API 端点总览

### 用户管理 API

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/users` | 获取所有用户 |
| GET | `/api/users/:id` | 获取单个用户 |
| POST | `/api/users` | 创建新用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/users/export/csv` | 导出 CSV |

### TODO 待办事项 API

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/todos` | 获取所有待办 |
| GET | `/api/todos/:id` | 获取单个待办 |
| POST | `/api/todos` | 创建新待办 |
| PUT | `/api/todos/:id` | 更新待办 |
| DELETE | `/api/todos/:id` | 删除待办 |

### 🔐 认证 API（JWT）

| 方法 | 端点 | 权限 | 功能 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 用户注册 |
| POST | `/api/auth/login` | 公开 | 用户登录（获取 Token） |
| POST | `/api/auth/refresh` | 公开 | 刷新 Access Token |
| POST | `/api/auth/logout` | 公开 | 退出登录（撤销 Token） |
| GET | `/api/auth/profile` | 🔒 登录用户 | 获取当前用户信息 |
| GET | `/api/auth/accounts` | 🔒👑 管理员 | 查看所有账号 |
| DELETE | `/api/auth/accounts/:id` | 🔒👑 管理员 | 删除指定账号 |

> 🔒 = 需要 `Authorization: Bearer <token>` 请求头
> 👑 = 仅管理员角色可访问

---

## 🧪 测试 API

### 认证流程

```bash
# 1. 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123"}'

# 2. 登录获取 Token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123"}'

# 3. 用 Token 访问受保护接口
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <你的accessToken>"

# 4. 刷新 Token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<你的refreshToken>"}'

# 5. 退出登录
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<你的refreshToken>"}'
```

### 用户 CRUD

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

### TODO 管理

```bash
# 创建待办
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"学习 Node.js"}'

# 获取所有待办
curl http://localhost:3000/api/todos

# 标记完成
curl -X PUT http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

# 删除待办
curl -X DELETE http://localhost:3000/api/todos/1
```

### 使用浏览器

直接访问 http://localhost:3000 查看 Web 界面！

---

## 📂 项目结构

```
pilot-test/
├── index.js                 # 初级功能主文件（CLI 工具）
├── server.js                # HTTP 服务器 + RESTful API + 路由
├── auth.js                  # JWT 认证模块（注册/登录/鉴权/授权）
├── store.js                 # 通用 JSON 文件存储模块
├── package.json             # 项目配置与依赖
├── .gitignore               # Git 忽略文件
├── README.md                # 项目说明（本文件）
├── 初级功能说明.md           # 初级功能详细文档
├── 中级功能说明.md           # 中级功能详细文档
├── 高级功能说明.md           # 高级功能详细文档（JWT 认证）
├── log.txt                  # 日志文件（自动生成）
└── data/                    # 数据目录（自动生成）
    ├── users.json           # 用户数据
    ├── todos.json           # 待办事项数据
    └── accounts.json        # 认证账号数据
```

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
4. JSON 数据处理
5. 异步编程 (Promise, async/await)
6. 数据持久化
7. 错误处理和状态码

### 第三阶段：高级功能 ✅
1. JWT 身份验证（双 Token 机制）
2. 密码加密（bcrypt）
3. 角色权限控制（RBAC）
4. Token 刷新与撤销
5. 通用数据存储模块设计

### 第四阶段：更多可能 🔮
- 数据库集成 (SQLite/MongoDB)
- WebSocket 实时通信
- 单元测试与集成测试
- Docker 容器化部署
- CI/CD 持续集成

---

## 💡 技术栈

- **语言**: JavaScript (Node.js)
- **核心模块**:
  - `http` - HTTP 服务器
  - `fs` - 文件系统
  - `path` - 路径处理
  - `url` - URL 解析
  - `crypto` - 加密工具
- **第三方依赖**:
  - `jsonwebtoken` - JWT 签发与验证
  - `bcryptjs` - 密码 bcrypt 哈希加密
- **数据格式**: JSON, CSV
- **API 风格**: RESTful
- **认证方式**: JWT Bearer Token

---

## 🌟 项目特色

✨ **中文友好** - 完整的中文文档、注释和错误提示
✨ **循序渐进** - 从简单到复杂，分三个阶段学习
✨ **代码清晰** - 良好的代码结构、命名和注释
✨ **功能完整** - 涵盖实际开发中的核心功能
✨ **易于扩展** - 模块化设计，方便添加新功能
✨ **安全实践** - JWT 认证、密码加密、角色权限控制

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📝 许可证

ISC License

---

## 🎓 学习资源

- [Node.js 官方文档](https://nodejs.org/docs/)
- [JavaScript 教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
- [HTTP 协议详解](https://developer.mozilla.org/zh-CN/docs/Web/HTTP)
- [RESTful API 设计指南](https://restfulapi.net/)
- [JWT 官方介绍](https://jwt.io/introduction)
- [OWASP 安全最佳实践](https://owasp.org/www-project-web-security-testing-guide/)

---

**快乐学习！Happy Coding! 🎉**
