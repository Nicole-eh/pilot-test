#!/usr/bin/env node

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ==================== 1. index.js 单元测试 ====================

describe('index.js - greet', () => {
  const { greet } = require('./index');

  it('should greet with default name', () => {
    assert.equal(greet(), '你好, World! 👋');
  });

  it('should greet with a given name', () => {
    assert.equal(greet('小明'), '你好, 小明! 👋');
  });

  it('should greet with English name', () => {
    assert.equal(greet('Alice'), '你好, Alice! 👋');
  });
});

describe('index.js - calculator', () => {
  const { calculator } = require('./index');

  it('should add two numbers', () => {
    assert.equal(calculator('add', '5', '3'), '5 + 3 = 8');
  });

  it('should subtract two numbers', () => {
    assert.equal(calculator('subtract', '10', '4'), '10 - 4 = 6');
  });

  it('should multiply two numbers', () => {
    assert.equal(calculator('multiply', '6', '7'), '6 × 7 = 42');
  });

  it('should divide two numbers', () => {
    assert.equal(calculator('divide', '20', '4'), '20 ÷ 4 = 5');
  });

  it('should handle division by zero', () => {
    const result = calculator('divide', '10', '0');
    assert.ok(result.includes('除数不能为 0'));
  });

  it('should handle invalid numbers', () => {
    const result = calculator('add', 'abc', '5');
    assert.ok(result.includes('请输入有效的数字'));
  });

  it('should support Chinese commands', () => {
    assert.equal(calculator('加', '5', '3'), '5 + 3 = 8');
    assert.equal(calculator('减', '10', '4'), '10 - 4 = 6');
    assert.equal(calculator('乘', '6', '7'), '6 × 7 = 42');
    assert.equal(calculator('除', '20', '4'), '20 ÷ 4 = 5');
  });

  it('should handle unsupported operation', () => {
    const result = calculator('power', '2', '3');
    assert.ok(result.includes('不支持的运算'));
  });

  it('should handle decimal numbers', () => {
    assert.equal(calculator('add', '1.5', '2.5'), '1.5 + 2.5 = 4');
  });
});

// ==================== 2. store.js 单元测试 ====================

describe('JsonStore', () => {
  const JsonStore = require('./store');
  const TEST_FILE = path.join(__dirname, 'data', '_test_store.json');
  let store;

  beforeEach(() => {
    // Clean up before each test
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
    store = new JsonStore(TEST_FILE);
  });

  after(() => {
    // Final cleanup
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
    const tmpFile = TEST_FILE + '.tmp';
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  it('should start with empty data', () => {
    assert.deepEqual(store.getAll(), []);
    assert.equal(store.count, 0);
  });

  it('should create a record with auto-generated id', () => {
    const record = store.create({ text: 'Test item', done: false });
    assert.equal(record.id, 1);
    assert.equal(record.text, 'Test item');
    assert.equal(record.done, false);
    assert.ok(record.createdAt);
  });

  it('should auto-increment ids', () => {
    const r1 = store.create({ text: 'First' });
    const r2 = store.create({ text: 'Second' });
    const r3 = store.create({ text: 'Third' });
    assert.equal(r1.id, 1);
    assert.equal(r2.id, 2);
    assert.equal(r3.id, 3);
  });

  it('should get all records', () => {
    store.create({ text: 'A' });
    store.create({ text: 'B' });
    const all = store.getAll();
    assert.equal(all.length, 2);
    assert.equal(all[0].text, 'A');
    assert.equal(all[1].text, 'B');
  });

  it('should return a copy from getAll (not a reference)', () => {
    store.create({ text: 'A' });
    const all = store.getAll();
    all.push({ id: 999, text: 'injected' });
    assert.equal(store.getAll().length, 1);
  });

  it('should get a record by id', () => {
    store.create({ text: 'Find me' });
    const found = store.getById(1);
    assert.equal(found.text, 'Find me');
  });

  it('should get a record by string id', () => {
    store.create({ text: 'Find me' });
    const found = store.getById('1');
    assert.equal(found.text, 'Find me');
  });

  it('should return null for non-existent id', () => {
    const found = store.getById(999);
    assert.equal(found, null);
  });

  it('should update a record', () => {
    store.create({ text: 'Original', done: false });
    const updated = store.update(1, { text: 'Updated', done: true });
    assert.equal(updated.text, 'Updated');
    assert.equal(updated.done, true);
    assert.ok(updated.updatedAt);
  });

  it('should not allow id to be changed via update', () => {
    store.create({ text: 'Test' });
    const updated = store.update(1, { id: 999 });
    assert.equal(updated.id, 1);
  });

  it('should return null when updating non-existent record', () => {
    const result = store.update(999, { text: 'nope' });
    assert.equal(result, null);
  });

  it('should delete a record', () => {
    store.create({ text: 'Delete me' });
    const deleted = store.delete(1);
    assert.equal(deleted.text, 'Delete me');
    assert.equal(store.count, 0);
  });

  it('should return null when deleting non-existent record', () => {
    const result = store.delete(999);
    assert.equal(result, null);
  });

  it('should persist data to file', () => {
    store.create({ text: 'Persistent' });
    // Create a new store instance pointing to the same file
    const store2 = new JsonStore(TEST_FILE);
    const all = store2.getAll();
    assert.equal(all.length, 1);
    assert.equal(all[0].text, 'Persistent');
  });

  it('should initialize with default data', () => {
    const defaultFile = path.join(__dirname, 'data', '_test_default.json');
    if (fs.existsSync(defaultFile)) fs.unlinkSync(defaultFile);

    const defaults = [{ id: 1, text: 'default item' }];
    const storeWithDefaults = new JsonStore(defaultFile, defaults);
    assert.equal(storeWithDefaults.count, 1);
    assert.equal(storeWithDefaults.getAll()[0].text, 'default item');

    // Cleanup
    if (fs.existsSync(defaultFile)) fs.unlinkSync(defaultFile);
  });
});

// ==================== 3. server.js HTTP API 集成测试 ====================

describe('HTTP API', () => {
  let serverProcess;
  const PORT = 3456; // Use a different port to avoid conflicts
  const BASE = `http://localhost:${PORT}`;

  // Helper: make HTTP requests
  function request(method, urlPath, body, extraHeaders) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(urlPath, BASE);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method,
        headers: { ...(extraHeaders || {}) }
      };

      if (body) {
        const data = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(responseBody);
          } catch {
            parsed = responseBody;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  before(async () => {
    // Start the server on a custom port
    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      serverProcess = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: String(PORT) },
        cwd: __dirname,
        stdio: 'pipe'
      });

      let started = false;
      serverProcess.stdout.on('data', (data) => {
        if (!started && data.toString().includes('服务器运行在')) {
          started = true;
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        // Ignore stderr during startup
      });

      serverProcess.on('error', reject);

      // Timeout: if server doesn't start in 10s, reject
      setTimeout(() => {
        if (!started) reject(new Error('Server failed to start within 10 seconds'));
      }, 10000);
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  // --- Users API ---

  describe('GET /api/users', () => {
    it('should return a list of users', async () => {
      const res = await request('GET', '/api/users');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(typeof res.body.count === 'number');
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const res = await request('POST', '/api/users', {
        name: 'TestUser',
        email: `test-${Date.now()}@example.com`,
        age: 20
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'TestUser');
    });

    it('should reject user without name', async () => {
      const res = await request('POST', '/api/users', {
        email: 'noname@example.com'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('should reject user without email', async () => {
      const res = await request('POST', '/api/users', {
        name: 'NoEmail'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('should reject duplicate email', async () => {
      const email = `dup-${Date.now()}@example.com`;
      await request('POST', '/api/users', { name: 'First', email, age: 20 });
      const res = await request('POST', '/api/users', { name: 'Second', email, age: 25 });
      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('已被使用'));
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return a single user', async () => {
      const res = await request('GET', '/api/users/1');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, 1);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request('GET', '/api/users/99999');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update a user', async () => {
      const res = await request('PUT', '/api/users/1', { age: 99 });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.age, 99);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request('PUT', '/api/users/99999', { name: 'Ghost' });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      const res = await request('GET', '/api/stats');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(typeof res.body.data.total === 'number');
      assert.ok(typeof res.body.data.averageAge === 'number');
    });
  });

  describe('GET /api/users/export/csv', () => {
    it('should return CSV data', async () => {
      const res = await request('GET', '/api/users/export/csv');
      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(typeof res.body === 'string');
      assert.ok(res.body.includes('id,name,email,age,createdAt'));
    });
  });

  // --- TODO API ---

  describe('TODO API', () => {
    let createdTodoId;

    it('POST /api/todos should create a todo', async () => {
      const res = await request('POST', '/api/todos', { text: 'Test todo item' });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.text, 'Test todo item');
      assert.equal(res.body.data.done, false);
      createdTodoId = res.body.data.id;
    });

    it('POST /api/todos should reject empty text', async () => {
      const res = await request('POST', '/api/todos', { text: '' });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/todos should reject missing text', async () => {
      const res = await request('POST', '/api/todos', {});
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('GET /api/todos should return all todos', async () => {
      const res = await request('GET', '/api/todos');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
    });

    it('GET /api/todos/:id should return a single todo', async () => {
      const res = await request('GET', `/api/todos/${createdTodoId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.text, 'Test todo item');
    });

    it('GET /api/todos/:id should return 404 for non-existent todo', async () => {
      const res = await request('GET', '/api/todos/99999');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('PUT /api/todos/:id should update a todo', async () => {
      const res = await request('PUT', `/api/todos/${createdTodoId}`, {
        text: 'Updated todo',
        done: true
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.text, 'Updated todo');
      assert.equal(res.body.data.done, true);
    });

    it('PUT /api/todos/:id should return 404 for non-existent todo', async () => {
      const res = await request('PUT', '/api/todos/99999', { text: 'Ghost' });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('DELETE /api/todos/:id should delete a todo', async () => {
      const res = await request('DELETE', `/api/todos/${createdTodoId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('DELETE /api/todos/:id should return 404 for non-existent todo', async () => {
      const res = await request('DELETE', '/api/todos/99999');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  // --- Auth API ---

  describe('Auth API', () => {
    const testUsername = `tu_${Date.now().toString(36)}`;
    const testPassword = 'password123';
    let accessToken;
    let refreshToken;

    it('POST /api/auth/register should register a user', async () => {
      const res = await request('POST', '/api/auth/register', {
        username: testUsername,
        password: testPassword
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.username, testUsername);
      assert.equal(res.body.data.role, 'user');
    });

    it('POST /api/auth/register should reject duplicate username', async () => {
      const res = await request('POST', '/api/auth/register', {
        username: testUsername,
        password: testPassword
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
    });

    it('POST /api/auth/register should reject short password', async () => {
      const res = await request('POST', '/api/auth/register', {
        username: `shortpw_${Date.now()}`,
        password: '123'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/auth/register should reject short username', async () => {
      const res = await request('POST', '/api/auth/register', {
        username: 'ab',
        password: 'password123'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/auth/login should login successfully', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: testUsername,
        password: testPassword
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.accessToken);
      assert.ok(res.body.data.refreshToken);
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('POST /api/auth/login should reject wrong password', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: testUsername,
        password: 'wrongpassword'
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/auth/profile should return 401 without token', async () => {
      const res = await request('GET', '/api/auth/profile');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/auth/profile should return profile with valid token', async () => {
      assert.ok(accessToken, 'accessToken should be set from login test');
      const res = await request('GET', '/api/auth/profile', null, {
        'Authorization': `Bearer ${accessToken}`
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.username, testUsername);
    });

    it('POST /api/auth/refresh should refresh token', async () => {
      const res = await request('POST', '/api/auth/refresh', {
        refreshToken: refreshToken
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.accessToken);
      assert.ok(res.body.data.refreshToken);
      // Update tokens for subsequent tests
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('POST /api/auth/logout should succeed', async () => {
      const res = await request('POST', '/api/auth/logout', {
        refreshToken: refreshToken
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('GET /api/auth/accounts should return 401 without token', async () => {
      const res = await request('GET', '/api/auth/accounts');
      assert.equal(res.status, 401);
    });

    it('GET /api/auth/accounts should return 403 for non-admin', async () => {
      const res = await request('GET', '/api/auth/accounts', null, {
        'Authorization': `Bearer ${accessToken}`
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  // --- Misc ---

  describe('Misc routes', () => {
    it('GET / should return HTML homepage', async () => {
      const res = await request('GET', '/');
      assert.equal(res.status, 200);
      // Body is a string since it's HTML (not valid JSON)
      assert.ok(typeof res.body === 'string');
      assert.ok(res.body.includes('Node.js'));
    });

    it('GET /api/nonexistent should return 404', async () => {
      const res = await request('GET', '/api/nonexistent');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('OPTIONS should handle CORS preflight', async () => {
      const res = await request('OPTIONS', '/api/users');
      assert.equal(res.status, 204);
      assert.ok(res.headers['access-control-allow-origin']);
      assert.ok(res.headers['access-control-allow-methods']);
    });
  });
});
