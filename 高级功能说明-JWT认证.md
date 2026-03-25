# Node.js 高级功能 - JWT 身份认证系统 🔐

完整的生产级 JWT 认证和授权系统，使用 Node.js 原生模块实现。

---

## 📚 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [API 文档](#api-文档)
- [认证流程](#认证流程)
- [技术实现](#技术实现)
- [安全最佳实践](#安全最佳实践)
- [测试指南](#测试指南)

---

## ✨ 功能特性

### 🔑 核心功能
- ✅ **用户注册** - 邮箱验证、密码强度检查
- ✅ **用户登录** - 用户名/邮箱登录支持
- ✅ **JWT Token** - 无状态认证，标准 JWT 格式
- ✅ **Token 刷新** - 访问令牌 + 刷新令牌双令牌机制
- ✅ **密码加密** - PBKDF2 算法（10000 次迭代 + SHA512）
- ✅ **权限控制** - 基于角色的访问控制（RBAC）
- ✅ **认证中间件** - 保护 API 端点

### 🛡️ 安全特性
- 🔒 密码加密存储（PBKDF2 + Salt）
- 🔒 JWT 签名验证（HMAC-SHA256）
- 🔒 Token 过期检查
- 🔒 邮箱格式验证
- 🔒 密码强度验证
- 🔒 防止重复注册

### 📦 技术优势
- ✅ **零依赖** - 只使用 Node.js 原生模块
- ✅ **标准化** - 完全符合 JWT 标准（RFC 7519）
- ✅ **生产就绪** - 完整的错误处理和验证
- ✅ **易于扩展** - 模块化设计

---

## 🚀 快速开始

### 1. 启动服务器

```bash
# 方式一：直接运行
node auth-server.js

# 方式二：使用 npm 脚本
npm run auth

# 方式三：自定义端口和密钥
PORT=5000 JWT_SECRET=my-secret-key node auth-server.js
```

服务器将在 `http://localhost:4000` 启动

### 2. 访问 Web 界面

打开浏览器访问：`http://localhost:4000`

### 3. 运行自动化测试

```bash
# 赋予执行权限
chmod +x test-auth.sh

# 运行测试
./test-auth.sh
```

---

## 📖 API 文档

### 基础信息

- **Base URL**: `http://localhost:4000`
- **Content-Type**: `application/json`
- **认证方式**: `Bearer Token`

### 公开端点（无需认证）

#### 1. 用户注册

**端点**: `POST /api/auth/register`

**请求体**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "name": "测试用户"
}
```

**响应**:
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "name": "测试用户",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "a1b2c3d4e5f6...",
    "expiresIn": 3600
  }
}
```

**验证规则**:
- `username`: 必填，唯一
- `email`: 必填，唯一，符合邮箱格式
- `password`: 必填，至少 6 个字符
- `name`: 可选，默认为 username

---

#### 2. 用户登录

**端点**: `POST /api/auth/login`

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**说明**:
- `username` 字段支持用户名或邮箱

**响应**: 同注册接口

---

#### 3. 刷新 Token

**端点**: `POST /api/auth/refresh`

**请求体**:
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**响应**:
```json
{
  "success": true,
  "message": "令牌刷新成功",
  "data": {
    "token": "new-access-token...",
    "expiresIn": 3600
  }
}
```

---

#### 4. 用户登出

**端点**: `POST /api/auth/logout`

**请求体**:
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

### 受保护端点（需要认证）

#### 5. 获取当前用户信息

**端点**: `GET /api/auth/me`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "name": "测试用户",
    "role": "user",
    "createdAt": "2024-03-25T10:30:00.000Z"
  }
}
```

---

#### 6. 获取所有用户（仅管理员）

**端点**: `GET /api/protected/users`

**请求头**:
```
Authorization: Bearer ADMIN_ACCESS_TOKEN
```

**权限要求**: `role: admin`

**响应**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "name": "测试用户",
      "role": "user",
      "createdAt": "2024-03-25T10:30:00.000Z"
    }
  ]
}
```

---

### 错误响应格式

**401 未授权**:
```json
{
  "success": false,
  "message": "未授权"
}
```

**403 权限不足**:
```json
{
  "success": false,
  "message": "权限不足"
}
```

**400 请求错误**:
```json
{
  "success": false,
  "message": "邮箱格式不正确"
}
```

---

## 🔄 认证流程

### 1. 注册流程

```
用户输入信息
    ↓
验证邮箱格式
    ↓
验证密码强度
    ↓
检查用户名/邮箱唯一性
    ↓
密码加密（PBKDF2）
    ↓
保存用户数据
    ↓
生成 JWT Token
    ↓
生成刷新令牌
    ↓
返回用户信息 + Token
```

### 2. 登录流程

```
用户输入用户名/密码
    ↓
查找用户
    ↓
验证密码
    ↓
生成 JWT Token
    ↓
生成刷新令牌
    ↓
返回用户信息 + Token
```

### 3. 访问受保护资源

```
客户端携带 Token
    ↓
解析 Authorization Header
    ↓
验证 Token 格式
    ↓
验证 Token 签名
    ↓
检查 Token 过期
    ↓
提取用户信息
    ↓
检查权限
    ↓
返回资源
```

### 4. Token 刷新流程

```
访问令牌过期
    ↓
使用刷新令牌
    ↓
验证刷新令牌
    ↓
检查有效期
    ↓
生成新的访问令牌
    ↓
返回新令牌
```

---

## 🔧 技术实现

### JWT Token 结构

```
Header.Payload.Signature
```

**Header**:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload**:
```json
{
  "id": 1,
  "username": "testuser",
  "role": "user",
  "iat": 1679734800,
  "exp": 1679738400
}
```

**Signature**:
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  secret
)
```

### 密码加密

使用 PBKDF2（Password-Based Key Derivation Function 2）：

```javascript
// 加密
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');

// 存储格式: salt:hash
stored = `${salt}:${hash}`
```

**参数说明**:
- **Salt**: 16 字节随机盐
- **迭代次数**: 10000 次
- **密钥长度**: 64 字节
- **哈希算法**: SHA512

### 认证中间件实现

```javascript
async function authenticateRequest(req) {
  // 1. 提取 Token
  const token = req.headers.authorization?.replace('Bearer ', '');

  // 2. 验证 Token
  const result = verifyToken(token);

  // 3. 返回用户信息
  return result.valid
    ? { authenticated: true, user: result.payload }
    : { authenticated: false, error: result.error };
}
```

---

## 🛡️ 安全最佳实践

### 1. 环境变量配置

⚠️ **生产环境必须设置**:

```bash
# .env 文件
JWT_SECRET=your-super-strong-secret-key-min-32-chars
PORT=4000
```

```bash
# 启动命令
JWT_SECRET=my-secret node auth-server.js
```

### 2. JWT Secret 要求

- ✅ 至少 32 个字符
- ✅ 包含大小写字母、数字、特殊字符
- ✅ 定期更换
- ❌ 不要硬编码
- ❌ 不要提交到版本控制

生成强密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Token 过期时间

**推荐配置**:
- **访问令牌**: 15 分钟 - 1 小时
- **刷新令牌**: 7 - 30 天

当前配置：
- 访问令牌: 1 小时
- 刷新令牌: 7 天

### 4. HTTPS

⚠️ **生产环境必须使用 HTTPS**

Token 在网络传输时必须加密，否则可能被窃取。

### 5. 密码策略

建议要求：
- ✅ 至少 8 个字符（当前为 6）
- ✅ 包含大写字母
- ✅ 包含小写字母
- ✅ 包含数字
- ✅ 包含特殊字符

### 6. 速率限制

建议添加：
- 登录失败次数限制
- API 请求频率限制
- IP 黑名单

---

## 🧪 测试指南

### 使用 cURL 测试

#### 1. 注册
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

#### 2. 登录
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

#### 3. 访问受保护端点
```bash
# 替换 YOUR_TOKEN 为实际的 token
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. 刷新 Token
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### 使用测试脚本

```bash
# 运行完整测试套件
./test-auth.sh
```

测试内容：
- ✅ 用户注册
- ✅ 用户登录
- ✅ Token 认证
- ✅ 无效 Token 拒绝
- ✅ Token 刷新
- ✅ 权限控制
- ✅ 用户登出

---

## 📂 数据存储

### 用户数据 (data/auth-users.json)

```json
[
  {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "name": "测试用户",
    "password": "salt:hash",
    "createdAt": "2024-03-25T10:30:00.000Z",
    "role": "user"
  }
]
```

### 刷新令牌 (data/refresh-tokens.json)

```json
[
  {
    "token": "a1b2c3d4e5f6...",
    "userId": 1,
    "createdAt": "2024-03-25T10:30:00.000Z",
    "expiresAt": "2024-04-01T10:30:00.000Z"
  }
]
```

---

## 🎯 常见问题

### Q1: Token 过期后怎么办？

使用刷新令牌获取新的访问令牌：
```javascript
POST /api/auth/refresh
{ "refreshToken": "your-refresh-token" }
```

### Q2: 如何修改 Token 过期时间？

修改 `CONFIG` 对象：
```javascript
const CONFIG = {
  JWT_EXPIRES_IN: 3600,  // 1小时
  REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 3600  // 7天
};
```

### Q3: 如何添加新的角色？

在注册时设置 `role` 字段，然后在中间件中检查：
```javascript
if (user.role !== 'admin') {
  return { error: '权限不足' };
}
```

### Q4: 如何撤销 Token？

两种方式：
1. **登出时删除刷新令牌**（当前实现）
2. **维护 Token 黑名单**（需要添加）

---

## 🚀 下一步计划

可以继续添加的功能：

1. **邮箱验证** - 注册后发送验证邮件
2. **忘记密码** - 密码重置功能
3. **双因素认证** - TOTP/SMS 验证
4. **社交登录** - OAuth2（Google, GitHub）
5. **用户权限系统** - 细粒度权限控制
6. **Token 黑名单** - Redis 缓存
7. **审计日志** - 记录所有认证操作
8. **速率限制** - 防止暴力破解

---

## 📚 学习资源

- [JWT 官方网站](https://jwt.io/)
- [RFC 7519 - JWT 标准](https://tools.ietf.org/html/rfc7519)
- [OWASP 认证备忘单](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Crypto 文档](https://nodejs.org/api/crypto.html)

---

## 🎓 核心概念

### JWT (JSON Web Token)
一种开放标准（RFC 7519），用于在各方之间安全地传输信息。

### PBKDF2
基于密码的密钥派生函数，用于安全地存储密码。

### RBAC (Role-Based Access Control)
基于角色的访问控制，通过角色管理权限。

### Bearer Token
一种 HTTP 认证方案，Token 持有者可以访问受保护的资源。

---

**快乐学习！Happy Coding! 🎉**
