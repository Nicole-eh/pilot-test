# Node.js 学习项目 🚀

从初级到高级的 Node.js 完整学习项目，包含命令行工具、HTTP 服务器、RESTful API 和 JWT 认证。

## 📚 项目概览

这个项目分为三个层级，循序渐进地学习 Node.js 开发：

### 🌱 初级功能 (index.js)
- ✅ 命令行参数处理
- ✅ 文件读写（日志系统）
- ✅ TODO 待办事项（增删改查）
- ✅ 简单计算器
- ✅ 中文友好的命令行界面

### 🚀 中级功能 (server.js)
- ✅ HTTP Web 服务器
- ✅ RESTful API（用户 CRUD）
- ✅ TODO API（待办事项 CRUD）
- ✅ JSON 数据处理
- ✅ CSV 数据导出
- ✅ 数据统计分析
- ✅ 漂亮的 Web 界面

### 🔐 高级功能 (auth.js)
- ✅ JWT 身份验证（双 Token 机制）
- ✅ 用户注册与登录（bcrypt 密码加密）
- ✅ Token 刷新与撤销
- ✅ 角色权限控制（admin / user）
- ✅ 受保护的 API 端点

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

# TODO 待办事项
node index.js todo add 学习Node
node index.js todo list
node index.js todo done 1
node index.js todo remove 1
```

### 运行中级 + 高级功能（HTTP 服务器）
```bash
# 启动服务器
npm run server
# 或者
node server.js

# 打开浏览器访问
# http://localhost:3000
```

### 运行测试脚本
```bash
# API 功能测试
bash test-api.sh

# JWT 认证功能测试
bash test-auth.sh
```

---

## 📖 详细文档

- [初级功能说明](./初级功能说明.md) - 命令行工具开发
- [中级功能说明](./中级功能说明.md) - HTTP 服务器和 API 开发
- [高级功能说明](./高级功能说明.md) - JWT 身份验证 + 角色权限控制

---

## 🎓 学习路线

### 第一阶段：初级功能 ✅
1. Node.js 基础语法
2. 命令行参数处理 (`process.argv`)
3. 文件系统操作 (`fs` 模块)
4. 字符串处理和格式化
5. JSON 数据存储（TODO 待办事项）
6. 模块化和导出

### 第二阶段：中级功能 ✅
1. HTTP 服务器 (`http` 模块)
2. URL 路由和参数解析
3. RESTful API 设计
4. JSON 数据处理
5. 异步编程 (Promise, async/await)
6. 数据持久化
7. 错误处理和状态码

### 第三阶段：高级功能 ✅
1. JWT 身份验证（jsonwebtoken）
2. 密码加密（bcryptjs）
3. 双 Token 机制（Access Token + Refresh Token）
4. 中间件鉴权
5. 角色权限控制（RBAC）
6. Token 刷新与撤销

---

## 📂 项目结构

```
pilot-test/
├── index.js                 # 初级功能主文件（CLI 工具）
├── server.js                # 中级+高级功能 HTTP 服务器
├── auth.js                  # JWT 认证模块
├── store.js                 # 通用 JSON 文件存储模块
├── package.json             # 项目配置
├── .gitignore               # Git 忽略文件
├── README.md                # 项目说明（本文件）
├── 初级功能说明.md           # 初级功能详细文档
├── 中级功能说明.md           # 中级功能详细文档
├── 高级功能说明.md           # 高级功能详细文档
├── test-api.sh              # API 测试脚本
├── test-auth.sh             # JWT 认证测试脚本
├── log.txt                  # 日志文件
└── data/
    ├── users.json           # 用户数据（自动生成）
    ├── todos.json           # TODO 待办事项数据（自动生成）
    └── accounts.json        # 认证账号数据（自动生成）
```

---

## 🧪 测试 API

### 使用 curl

#### 用户 CRUD
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

#### TODO 待办事项
```bash
# 获取所有待办
curl http://localhost:3000/api/todos

# 创建待办
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"学习 Node.js"}'

# 更新待办（标记完成）
curl -X PUT http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

# 删除待办
curl -X DELETE http://localhost:3000/api/todos/1
```

#### JWT 认证
```bash
# 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'

# 登录获取 Token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'

# 用 Token 访问受保护接口
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <你的token>"
```

### 使用浏览器
直接访问 http://localhost:3000 查看漂亮的 Web 界面！

---

## 🌟 项目特色

✨ **轻量依赖** - 仅使用 `jsonwebtoken` 和 `bcryptjs`，核心逻辑基于 Node.js 原生模块
✨ **中文友好** - 完整的中文文档、注释和错误提示
✨ **循序渐进** - 从初级到高级，适合初学者逐步提升
✨ **代码清晰** - 良好的代码结构和注释
✨ **功能完整** - 涵盖实际开发中的核心功能（CRUD、认证、权限）
✨ **易于扩展** - 模块化设计，方便添加新功能

---

## 📊 API 端点总览

### 用户管理

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/` | 主页 |
| GET | `/api/users` | 获取所有用户 |
| GET | `/api/users/:id` | 获取单个用户 |
| POST | `/api/users` | 创建新用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/users/export/csv` | 导出 CSV |

### TODO 待办事项

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/todos` | 获取所有待办 |
| GET | `/api/todos/:id` | 获取单个待办 |
| POST | `/api/todos` | 创建新待办 |
| PUT | `/api/todos/:id` | 更新待办 |
| DELETE | `/api/todos/:id` | 删除待办 |

### 认证 (JWT)

| 方法 | 端点 | 权限 | 功能 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 用户注册 |
| POST | `/api/auth/login` | 公开 | 用户登录 |
| POST | `/api/auth/refresh` | 公开 | 刷新 Token |
| POST | `/api/auth/logout` | 公开 | 退出登录 |
| GET | `/api/auth/profile` | 🔒 登录用户 | 获取个人信息 |
| GET | `/api/auth/accounts` | 🔒👑 管理员 | 查看所有账号 |
| DELETE | `/api/auth/accounts/:id` | 🔒👑 管理员 | 删除账号 |

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
- **认证方式**: JWT (Bearer Token)

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
- [JWT 介绍](https://jwt.io/introduction)

---

**快乐学习！Happy Coding! 🎉**