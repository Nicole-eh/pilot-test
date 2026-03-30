# Node.js 学习项目 🚀

从初级到高级的 Node.js 完整学习项目，包含命令行工具、HTTP 服务器、RESTful API 和 JWT 身份认证。

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
- ✅ RESTful API（用户 CRUD）
- ✅ RESTful API（TODO CRUD）
- ✅ JSON 数据处理
- ✅ CSV 数据导出
- ✅ 数据统计分析
- ✅ 漂亮的 Web 界面

### 🔐 高级功能 (auth.js)
- ✅ JWT 身份验证（双 Token 机制）
- ✅ 用户注册与登录（bcrypt 密码加密）
- ✅ Token 刷新与撤销
- ✅ 角色权限控制（admin / user）
- ✅ 通用 JSON 数据存储模块（store.js）

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

# 待办事项
node index.js todo add 学习Node
node index.js todo list
node index.js todo done 1
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

## 📖 详细文档

- [初级功能说明](./初级功能说明.md) - 命令行工具开发
- [中级功能说明](./中级功能说明.md) - HTTP 服务器和 API 开发
- [高级功能说明](./高级功能说明.md) - JWT 认证与角色权限

---

## 📊 API 端点总览

### 用户 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取所有用户 |
| GET | `/api/users/:id` | 获取单个用户 |
| POST | `/api/users` | 创建新用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/users/export/csv` | 导出 CSV |

### TODO API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/todos` | 获取所有待办 |
| GET | `/api/todos/:id` | 获取单个待办 |
| POST | `/api/todos` | 创建新待办 |
| PUT | `/api/todos/:id` | 更新待办 |
| DELETE | `/api/todos/:id` | 删除待办 |

### 认证 API（JWT）

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 用户注册 |
| POST | `/api/auth/login` | 公开 | 用户登录（获取 Token） |
| POST | `/api/auth/refresh` | 公开 | 刷新 Access Token |
| POST | `/api/auth/logout` | 公开 | 退出登录（撤销 Token） |
| GET | `/api/auth/profile` | 🔒 登录用户 | 获取当前用户信息 |
| GET | `/api/auth/accounts` | 🔒👑 admin | 查看所有账号 |
| DELETE | `/api/auth/accounts/:id` | 🔒👑 admin | 删除指定账号 |

> 🔒 = 需要 `Authorization: Bearer <token>` 请求头 &nbsp;&nbsp; 👑 = 仅管理员

---

## 🧪 测试 API

### 使用 curl

```bash
# ---- 用户 CRUD ----
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

# ---- JWT 认证 ----
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}'

# 登录（获取 Token）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456"}'

# 用 Token 访问受保护接口
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <你的accessToken>"

# 刷新 Token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<你的refreshToken>"}'
```

### 使用测试脚本

```bash
# API 基础测试
bash test-api.sh

# JWT 认证完整测试（12 个用例）
bash test-auth.sh
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
├── .gitignore               # Git 忽略规则
├── README.md                # 项目说明（本文件）
├── 初级功能说明.md           # 初级功能详细文档
├── 中级功能说明.md           # 中级功能详细文档
├── 高级功能说明.md           # 高级功能详细文档（JWT 认证）
├── test-api.sh              # API 测试脚本
├── test-auth.sh             # JWT 认证测试脚本
├── log.txt                  # CLI 日志文件
└── data/
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
3. 中间件模式（认证 + 授权）
4. 角色权限控制（RBAC）
5. 通用数据存储抽象（JsonStore）

### 第四阶段：进阶方向 🔮 (规划中)
- 数据库集成 (SQLite/MongoDB)
- WebSocket 实时通信
- 单元测试
- 部署和 DevOps

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
- **认证方案**: JWT (Access Token + Refresh Token)

---

## 🌟 项目特色

✨ **轻量依赖** - 仅 2 个第三方依赖（jsonwebtoken + bcryptjs），核心逻辑使用原生模块
✨ **中文友好** - 完整的中文文档、注释和错误提示
✨ **循序渐进** - 从 CLI 到 HTTP 到认证，三阶段递进学习
✨ **代码清晰** - 良好的代码结构和详细注释
✨ **功能完整** - CRUD、认证、授权、导出，涵盖实际开发核心场景
✨ **易于扩展** - 模块化设计（JsonStore 可复用），方便添加新功能

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
- [JWT 官网](https://jwt.io/) - 在线调试 Token
- [bcrypt 原理](https://en.wikipedia.org/wiki/Bcrypt)

---

**快乐学习！Happy Coding! 🎉**
