const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

/**
 * Auth 模块测试
 *
 * 由于 auth.js 在 require 时会立即初始化 accountStore（读写 data/accounts.json），
 * 我们需要：
 * 1. 备份真实的 accounts.json
 * 2. 在测试前清空它
 * 3. 测试结束后恢复
 */

const ACCOUNTS_FILE = path.join(__dirname, '..', 'data', 'accounts.json');
let originalData = null;

// 清理 auth 模块缓存，确保每次重新加载
function requireFreshAuth() {
  // 清除缓存
  delete require.cache[require.resolve('../auth')];
  // 同时清除 store 缓存，因为 auth.js 中 new JsonStore 会在 require 时执行
  delete require.cache[require.resolve('../store')];
  return require('../auth');
}

describe('Auth 模块', () => {
  before(() => {
    // 备份原始数据
    if (fs.existsSync(ACCOUNTS_FILE)) {
      originalData = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    }
  });

  after(() => {
    // 恢复原始数据
    if (originalData !== null) {
      fs.writeFileSync(ACCOUNTS_FILE, originalData, 'utf8');
    }
  });

  beforeEach(() => {
    // 每个测试前重置 accounts.json 为空数组
    fs.writeFileSync(ACCOUNTS_FILE, '[]', 'utf8');
  });

  // ==================== register ====================
  describe('register()', () => {
    it('应成功注册新用户', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('testuser', 'password123');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 201);
      assert.strictEqual(result.data.username, 'testuser');
      assert.strictEqual(result.data.role, 'user');
      assert.ok(result.data.id);
      assert.ok(result.data.createdAt);
    });

    it('应成功注册 admin 用户', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('adminuser', 'password123', 'admin');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.role, 'admin');
    });

    it('无效角色应默认为 user', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('testuser', 'password123', 'superadmin');

      assert.strictEqual(result.data.role, 'user');
    });

    it('返回数据中不应包含密码', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('testuser', 'password123');

      assert.strictEqual(result.data.password, undefined);
    });

    it('用户名为空应报错', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('', 'password123');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('密码为空应报错', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('testuser', '');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('用户名过短应报错 (< 3)', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('ab', 'password123');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.ok(result.message.includes('3'));
    });

    it('用户名过长应报错 (> 20)', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('a'.repeat(21), 'password123');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('密码过短应报错 (< 6)', async () => {
      const auth = requireFreshAuth();
      const result = await auth.register('testuser', '12345');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.ok(result.message.includes('6'));
    });

    it('重复用户名应报错', async () => {
      const auth = requireFreshAuth();
      await auth.register('testuser', 'password123');
      const result = await auth.register('testuser', 'anotherpass');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 409);
    });
  });

  // ==================== login ====================
  describe('login()', () => {
    it('正确凭据应登录成功并返回双 Token', async () => {
      const auth = requireFreshAuth();
      await auth.register('loginuser', 'password123');
      const result = await auth.login('loginuser', 'password123');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.ok(result.data.accessToken, '应返回 accessToken');
      assert.ok(result.data.refreshToken, '应返回 refreshToken');
      assert.strictEqual(result.data.user.username, 'loginuser');
      assert.strictEqual(result.data.expiresIn, '15m');
    });

    it('错误密码应登录失败', async () => {
      const auth = requireFreshAuth();
      await auth.register('loginuser', 'password123');
      const result = await auth.login('loginuser', 'wrongpassword');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 401);
    });

    it('不存在的用户应登录失败', async () => {
      const auth = requireFreshAuth();
      const result = await auth.login('ghost', 'password123');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 401);
    });

    it('空用户名应报错', async () => {
      const auth = requireFreshAuth();
      const result = await auth.login('', 'password123');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('空密码应报错', async () => {
      const auth = requireFreshAuth();
      const result = await auth.login('testuser', '');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('返回的 accessToken 应为有效 JWT', async () => {
      const auth = requireFreshAuth();
      await auth.register('jwtuser', 'password123');
      const result = await auth.login('jwtuser', 'password123');

      const decoded = jwt.decode(result.data.accessToken);
      assert.strictEqual(decoded.username, 'jwtuser');
      assert.strictEqual(decoded.type, 'access');
    });

    it('返回的 refreshToken 应为有效 JWT', async () => {
      const auth = requireFreshAuth();
      await auth.register('jwtuser', 'password123');
      const result = await auth.login('jwtuser', 'password123');

      const decoded = jwt.decode(result.data.refreshToken);
      assert.strictEqual(decoded.username, 'jwtuser');
      assert.strictEqual(decoded.type, 'refresh');
      assert.ok(decoded.jti, '应包含 jti');
    });
  });

  // ==================== authenticate (中间件) ====================
  describe('authenticate()', () => {
    it('有效 Token 应通过认证', async () => {
      const auth = requireFreshAuth();
      await auth.register('authuser', 'password123');
      const loginResult = await auth.login('authuser', 'password123');

      const mockReq = {
        headers: { authorization: `Bearer ${loginResult.data.accessToken}` }
      };

      const result = auth.authenticate(mockReq);
      assert.strictEqual(result.authenticated, true);
      assert.strictEqual(result.user.username, 'authuser');
    });

    it('无 Token 应认证失败', () => {
      const auth = requireFreshAuth();
      const mockReq = { headers: {} };

      const result = auth.authenticate(mockReq);
      assert.strictEqual(result.authenticated, false);
    });

    it('无效 Token 应认证失败', () => {
      const auth = requireFreshAuth();
      const mockReq = {
        headers: { authorization: 'Bearer invalid.token.here' }
      };

      const result = auth.authenticate(mockReq);
      assert.strictEqual(result.authenticated, false);
    });

    it('格式错误（非 Bearer）应认证失败', () => {
      const auth = requireFreshAuth();
      const mockReq = {
        headers: { authorization: 'Basic sometoken' }
      };

      const result = auth.authenticate(mockReq);
      assert.strictEqual(result.authenticated, false);
    });

    it('使用 refreshToken 作为 accessToken 应失败', async () => {
      const auth = requireFreshAuth();
      await auth.register('mixuser', 'password123');
      const loginResult = await auth.login('mixuser', 'password123');

      const mockReq = {
        headers: { authorization: `Bearer ${loginResult.data.refreshToken}` }
      };

      const result = auth.authenticate(mockReq);
      assert.strictEqual(result.authenticated, false);
    });

    it('过期的 Token 应认证失败', () => {
      const auth = requireFreshAuth();
      // 手动签发一个已过期的 Token
      const expiredToken = jwt.sign(
        { id: 1, username: 'expired', role: 'user', type: 'access' },
        auth.CONFIG.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const mockReq = {
        headers: { authorization: `Bearer ${expiredToken}` }
      };

      const result = auth.authenticate(mockReq);
      assert.strictEqual(result.authenticated, false);
      assert.ok(result.error.includes('过期'));
    });
  });

  // ==================== authorize (角色权限) ====================
  describe('authorize()', () => {
    it('匹配角色应授权通过', () => {
      const auth = requireFreshAuth();
      const result = auth.authorize({ role: 'admin' }, 'admin');
      assert.strictEqual(result.authorized, true);
    });

    it('多角色匹配应授权通过', () => {
      const auth = requireFreshAuth();
      const result = auth.authorize({ role: 'user' }, 'admin', 'user');
      assert.strictEqual(result.authorized, true);
    });

    it('角色不匹配应授权失败', () => {
      const auth = requireFreshAuth();
      const result = auth.authorize({ role: 'user' }, 'admin');
      assert.strictEqual(result.authorized, false);
      assert.ok(result.error.includes('权限不足'));
    });
  });

  // ==================== refresh ====================
  describe('refresh()', () => {
    it('有效 refreshToken 应刷新成功', async () => {
      const auth = requireFreshAuth();
      await auth.register('refreshuser', 'password123');
      const loginResult = await auth.login('refreshuser', 'password123');

      const result = auth.refresh(loginResult.data.refreshToken);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.ok(result.data.accessToken);
      assert.ok(result.data.refreshToken);
    });

    it('刷新后旧 refreshToken 应失效（被撤销）', async () => {
      const auth = requireFreshAuth();
      await auth.register('revokeuser', 'password123');
      const loginResult = await auth.login('revokeuser', 'password123');
      const oldRefreshToken = loginResult.data.refreshToken;

      // 第一次刷新应成功
      const firstRefresh = auth.refresh(oldRefreshToken);
      assert.strictEqual(firstRefresh.success, true);

      // 再次使用旧 token 应失败
      const secondRefresh = auth.refresh(oldRefreshToken);
      assert.strictEqual(secondRefresh.success, false);
    });

    it('空 refreshToken 应报错', () => {
      const auth = requireFreshAuth();
      const result = auth.refresh('');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('无效 refreshToken 应报错', () => {
      const auth = requireFreshAuth();
      const result = auth.refresh('invalid.token.value');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 401);
    });
  });

  // ==================== logout ====================
  describe('logout()', () => {
    it('正常退出应成功', async () => {
      const auth = requireFreshAuth();
      await auth.register('logoutuser', 'password123');
      const loginResult = await auth.login('logoutuser', 'password123');

      const result = auth.logout(loginResult.data.refreshToken);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
    });

    it('退出后 refreshToken 应不能再用于刷新', async () => {
      const auth = requireFreshAuth();
      await auth.register('logoutuser2', 'password123');
      const loginResult = await auth.login('logoutuser2', 'password123');

      auth.logout(loginResult.data.refreshToken);
      const refreshResult = auth.refresh(loginResult.data.refreshToken);
      assert.strictEqual(refreshResult.success, false);
    });

    it('无 refreshToken 也应成功退出', () => {
      const auth = requireFreshAuth();
      const result = auth.logout('');
      assert.strictEqual(result.success, true);
    });

    it('无效 refreshToken 也应成功退出（不报错）', () => {
      const auth = requireFreshAuth();
      const result = auth.logout('invalid.token.data');
      assert.strictEqual(result.success, true);
    });
  });

  // ==================== getProfile ====================
  describe('getProfile()', () => {
    it('存在的用户 id 应返回个人信息', async () => {
      const auth = requireFreshAuth();
      const regResult = await auth.register('profileuser', 'password123');

      const result = auth.getProfile(regResult.data.id);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.username, 'profileuser');
      assert.strictEqual(result.data.password, undefined, '不应暴露密码');
    });

    it('不存在的用户 id 应返回 404', () => {
      const auth = requireFreshAuth();
      const result = auth.getProfile(999);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 404);
    });
  });

  // ==================== getAllAccounts ====================
  describe('getAllAccounts()', () => {
    it('应返回所有账号（不含密码）', async () => {
      const auth = requireFreshAuth();
      await auth.register('user1', 'password123');
      await auth.register('user2', 'password456');

      const result = auth.getAllAccounts();
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.length, 2);

      // 验证不含密码
      result.data.forEach(account => {
        assert.strictEqual(account.password, undefined);
        assert.ok(account.username);
        assert.ok(account.role);
      });
    });
  });

  // ==================== deleteAccount ====================
  describe('deleteAccount()', () => {
    it('admin 应能删除其他账号', async () => {
      const auth = requireFreshAuth();
      const admin = await auth.register('admin', 'password123', 'admin');
      const user = await auth.register('victim', 'password123');

      const result = auth.deleteAccount(user.data.id, admin.data.id);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.username, 'victim');
    });

    it('不能删除自己', async () => {
      const auth = requireFreshAuth();
      const admin = await auth.register('admin', 'password123', 'admin');

      const result = auth.deleteAccount(admin.data.id, admin.data.id);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
    });

    it('删除不存在的账号应返回 404', async () => {
      const auth = requireFreshAuth();
      const admin = await auth.register('admin', 'password123', 'admin');

      const result = auth.deleteAccount(999, admin.data.id);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 404);
    });
  });
});
