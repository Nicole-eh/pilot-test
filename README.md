# Node.js 学习项目 🚀

从初级到中级的 Node.js 完整学习项目，包含命令行工具、HTTP 服务器和 RESTful API。

## 📚 项目概览

这个项目分为两个层级，循序渐进地学习 Node.js 开发：

### 🌱 初级功能 (index.js)
- ✅ 命令行参数处理
- ✅ 文件读写（日志系统）
- ✅ 简单计算器
- ✅ TODO 待办事项（增删改查）
- ✅ 中文友好的命令行界面

### 🚀 中级功能 (server.js)
- ✅ HTTP Web 服务器
- ✅ RESTful API（用户 CRUD）
- ✅ JSON 数据处理
- ✅ CSV 数据导出
- ✅ 数据统计分析
- ✅ TODO 待办事项 API（CRUD）
- ✅ 漂亮的 Web 界面

---

## 🎯 快速开始

### 安装
```bash
# 克隆项目
git clone https://github.com/Nicole-eh/pilot-test.git
cd pilot-test

# 无需安装依赖（使用 Node.js 原生模块）
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
```

### 运行中级功能（HTTP 服务器）
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

---

## 🎓 学习路线

### 第一阶段：初级功能 ✅
1. Node.js 基础语法
2. 命令行参数处理 (`process.argv`)
3. 文件系统操作 (`fs` 模块)
4. 字符串处理和格式化
5. 模块化和导出

### 第二阶段：中级功能 🔥
1. HTTP 服务器 (`http` 模块)
2. URL 路由和参数解析
3. RESTful API 设计
4. JSON 数据处理
5. 异步编程 (Promise, async/await)
6. 数据持久化
7. 错误处理和状态码

### 第三阶段：高级功能 🚀 (即将推出)
- 数据库集成 (SQLite/MongoDB)
- 身份验证和授权 (JWT)
- 中间件系统
- WebSocket 实时通信
- 单元测试
- 部署和 DevOps

---

## 📂 项目结构

```
pilot-test/
├── index.js                 # 初级功能主文件
├── server.js                # 中级功能 HTTP 服务器
├── package.json             # 项目配置
├── .gitignore              # Git 忽略文件
├── README.md               # 项目说明（本文件）
├── 初级功能说明.md          # 初级功能详细文档
├── 中级功能说明.md          # 中级功能详细文档
├── store.js                # 通用 JSON 文件存储模块
├── auth.js                 # JWT 认证模块
├── log.txt                 # 日志文件
├── test-api.sh             # API 测试脚本
├── test-auth.sh            # 认证功能测试脚本
└── data/
    ├── users.json          # 用户数据（自动生成）
    ├── todos.json          # 待办事项数据（自动生成）
    └── accounts.json       # 账号数据（自动生成）
```

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

### 使用浏览器
直接访问 http://localhost:3000 查看漂亮的 Web 界面！

---

## 🌟 项目特色

✨ **零依赖** - 只使用 Node.js 内置模块，无需 npm install
✨ **中文友好** - 完整的中文文档、注释和错误提示
✨ **循序渐进** - 从简单到复杂，适合初学者
✨ **代码清晰** - 良好的代码结构和注释
✨ **功能完整** - 涵盖实际开发中的核心功能
✨ **易于扩展** - 模块化设计，方便添加新功能

---

## 📊 API 端点总览

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
| GET | `/api/todos` | 获取所有待办事项 |
| GET | `/api/todos/:id` | 获取单个待办事项 |
| POST | `/api/todos` | 创建新待办事项 |
| PUT | `/api/todos/:id` | 更新待办事项 |
| DELETE | `/api/todos/:id` | 删除待办事项 |

---

## 💡 技术栈

- **语言**: JavaScript (Node.js)
- **核心模块**:
  - `http` - HTTP 服务器
  - `fs` - 文件系统
  - `path` - 路径处理
  - `url` - URL 解析
- **数据格式**: JSON, CSV
- **API 风格**: RESTful

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

---

**快乐学习！Happy Coding! 🎉**