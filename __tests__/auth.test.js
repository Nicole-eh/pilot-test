const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

// We need to set up a clean environment for auth module tests.
// The auth module initializes an accountStore at require-time, so we
// manipulate the data directory before requiring it.

describe('auth module', () => {
  let tmpDir;
  let auth;
  let originalEnv;

  beforeEach(() => {
    // Save environment
    originalEnv = { ...process.env };

    // Create temp directory structure
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    const dataDir = path.join(tmpDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    // Write empty accounts file
    fs.writeFileSync(path.join(dataDir, 'accounts.json'), '[]', 'utf8');

    // We need to trick the auth module into using our temp directory.
    // Since auth.js uses __dirname, we'll use a fresh require with jest.isolateModules
    // Instead, we'll test via the exported functions and clean up the real data after.

    // Clear module cache to get a fresh instance
    jest.resetModules();

    // The auth module uses path.join(__dirname, 'data', 'accounts.json')
    // We can't easily override __dirname, so we'll work with the real file
    // but backup and restore it.
    const realAccountsFile = path.join(__dirname, '..', 'data', 'accounts.json');
    this.realAccountsBackup = fs.readFileSync(realAccountsFile, 'utf8');
    fs.writeFileSync(realAccountsFile, '[]', 'utf8');

    auth = require('../auth');
  });

  afterEach(() => {
    // Restore real accounts file
    const realAccountsFile = path.join(__dirname, '..', 'data', 'accounts.json');
    fs.writeFileSync(realAccountsFile, this.realAccountsBackup, 'utf8');

    // Restore environment
    process.env = originalEnv;

    // Clean temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      const result = await auth.register('testuser', 'password123');
      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(result.data.username).toBe('testuser');
      expect(result.data.role).toBe('user');
      expect(result.data.password).toBeUndefined(); // password should not be exposed
    });

    test('should register an admin user', async () => {
      const result = await auth.register('adminuser', 'password123', 'admin');
      expect(result.success).toBe(true);
      expect(result.data.role).toBe('admin');
    });

    test('should default to user role for invalid role', async () => {
      const result = await auth.register('someone', 'password123', 'superadmin');
      expect(result.success).toBe(true);
      expect(result.data.role).toBe('user');
    });

    test('should fail when username is missing', async () => {
      const result = await auth.register('', 'password123');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should fail when password is missing', async () => {
      const result = await auth.register('testuser', '');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should fail when username is too short', async () => {
      const result = await auth.register('ab', 'password123');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('3-20');
    });

    test('should fail when username is too long', async () => {
      const result = await auth.register('a'.repeat(21), 'password123');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should fail when password is too short', async () => {
      const result = await auth.register('testuser', '12345');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('6');
    });

    test('should fail when username already exists', async () => {
      await auth.register('duplicate', 'password123');
      const result = await auth.register('duplicate', 'password456');
      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await auth.register('loginuser', 'password123');
    });

    test('should login successfully with correct credentials', async () => {
      const result = await auth.login('loginuser', 'password123');
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data.accessToken).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.user.username).toBe('loginuser');
    });

    test('should fail with wrong password', async () => {
      const result = await auth.login('loginuser', 'wrongpassword');
      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    });

    test('should fail with non-existent username', async () => {
      const result = await auth.login('nonexistent', 'password123');
      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    });

    test('should fail when username is missing', async () => {
      const result = await auth.login('', 'password123');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should fail when password is missing', async () => {
      const result = await auth.login('loginuser', '');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });
  });

  describe('authenticate', () => {
    let accessToken;

    beforeEach(async () => {
      await auth.register('authuser', 'password123');
      const loginResult = await auth.login('authuser', 'password123');
      accessToken = loginResult.data.accessToken;
    });

    test('should authenticate a valid token', () => {
      const req = { headers: { authorization: `Bearer ${accessToken}` } };
      const result = auth.authenticate(req);
      expect(result.authenticated).toBe(true);
      expect(result.user.username).toBe('authuser');
    });

    test('should fail without authorization header', () => {
      const req = { headers: {} };
      const result = auth.authenticate(req);
      expect(result.authenticated).toBe(false);
    });

    test('should fail with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const result = auth.authenticate(req);
      expect(result.authenticated).toBe(false);
    });

    test('should fail with malformed authorization header', () => {
      const req = { headers: { authorization: 'NotBearer token' } };
      const result = auth.authenticate(req);
      expect(result.authenticated).toBe(false);
    });

    test('should fail with expired token', () => {
      // Create a token that is already expired
      const expiredToken = jwt.sign(
        { id: 1, username: 'test', role: 'user', type: 'access' },
        auth.CONFIG.JWT_SECRET,
        { expiresIn: '0s' }
      );
      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const result = auth.authenticate(req);
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('过期');
    });
  });

  describe('authorize', () => {
    test('should authorize user with matching role', () => {
      const user = { role: 'admin' };
      const result = auth.authorize(user, 'admin');
      expect(result.authorized).toBe(true);
    });

    test('should authorize user with one of multiple allowed roles', () => {
      const user = { role: 'user' };
      const result = auth.authorize(user, 'admin', 'user');
      expect(result.authorized).toBe(true);
    });

    test('should reject user without matching role', () => {
      const user = { role: 'user' };
      const result = auth.authorize(user, 'admin');
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('权限不足');
    });
  });

  describe('refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      await auth.register('refreshuser', 'password123');
      const loginResult = await auth.login('refreshuser', 'password123');
      refreshToken = loginResult.data.refreshToken;
    });

    test('should refresh tokens successfully', () => {
      const result = auth.refresh(refreshToken);
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data.accessToken).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      // New tokens should be different from old ones
      expect(result.data.refreshToken).not.toBe(refreshToken);
    });

    test('should revoke old refresh token after refresh', () => {
      auth.refresh(refreshToken);
      // Using the old token again should fail
      const result = auth.refresh(refreshToken);
      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    });

    test('should fail without refresh token', () => {
      const result = auth.refresh('');
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should fail with invalid refresh token', () => {
      const result = auth.refresh('invalid-token');
      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    });
  });

  describe('logout', () => {
    test('should logout successfully with valid refresh token', async () => {
      await auth.register('logoutuser', 'password123');
      const loginResult = await auth.login('logoutuser', 'password123');
      const result = auth.logout(loginResult.data.refreshToken);
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });

    test('should succeed even without refresh token', () => {
      const result = auth.logout('');
      expect(result.success).toBe(true);
    });

    test('should revoke the refresh token so it cannot be reused', async () => {
      await auth.register('logoutuser2', 'password123');
      const loginResult = await auth.login('logoutuser2', 'password123');
      auth.logout(loginResult.data.refreshToken);
      // Try to refresh with the revoked token
      const refreshResult = auth.refresh(loginResult.data.refreshToken);
      expect(refreshResult.success).toBe(false);
    });
  });

  describe('getProfile', () => {
    test('should return user profile for existing user', async () => {
      const reg = await auth.register('profileuser', 'password123');
      const result = auth.getProfile(reg.data.id);
      expect(result.success).toBe(true);
      expect(result.data.username).toBe('profileuser');
      expect(result.data.password).toBeUndefined(); // no password exposed
    });

    test('should return 404 for non-existent user', () => {
      const result = auth.getProfile(9999);
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });
  });

  describe('getAllAccounts', () => {
    test('should return all accounts without passwords', async () => {
      await auth.register('user1', 'password123');
      await auth.register('user2', 'password456');
      const result = auth.getAllAccounts();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      result.data.forEach(account => {
        expect(account.password).toBeUndefined();
        expect(account.username).toBeDefined();
      });
    });
  });

  describe('deleteAccount', () => {
    test('should delete another user account', async () => {
      const admin = await auth.register('admin1', 'password123', 'admin');
      const user = await auth.register('user1', 'password123');
      const result = auth.deleteAccount(user.data.id, admin.data.id);
      expect(result.success).toBe(true);
      expect(result.data.username).toBe('user1');
    });

    test('should not allow deleting own account', async () => {
      const admin = await auth.register('selfdelete', 'password123', 'admin');
      const result = auth.deleteAccount(admin.data.id, admin.data.id);
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    test('should return 404 for non-existent account', async () => {
      const admin = await auth.register('admin2', 'password123', 'admin');
      const result = auth.deleteAccount(9999, admin.data.id);
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });
  });
});
