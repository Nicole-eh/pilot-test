const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Router, normalizePath, parsePattern, matchRoute } = require('../router');

// ==================== 辅助工具 ====================

function mockReq(method, url) {
  return {
    method,
    url,
    pathname: url,
    headers: {},
    params: {},
    body: {}
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      if (headers) Object.assign(this.headers, headers);
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(data) {
      if (data) this.body = data;
    }
  };
}

// ==================== normalizePath 测试 ====================

describe('normalizePath - 路径标准化', () => {
  it('空字符串或 null 返回 "/"', () => {
    assert.equal(normalizePath(''), '/');
    assert.equal(normalizePath(null), '/');
    assert.equal(normalizePath(undefined), '/');
  });

  it('根路径不变', () => {
    assert.equal(normalizePath('/'), '/');
  });

  it('去除尾部斜杠', () => {
    assert.equal(normalizePath('/api/'), '/api');
    assert.equal(normalizePath('/users/'), '/users');
    assert.equal(normalizePath('/a/b/c/'), '/a/b/c');
  });

  it('无尾部斜杠的路径不变', () => {
    assert.equal(normalizePath('/api'), '/api');
    assert.equal(normalizePath('/users/1'), '/users/1');
  });
});

// ==================== parsePattern 测试 ====================

describe('parsePattern - 路由模式解析', () => {
  it('根路径 "/" 返回空 segments', () => {
    const result = parsePattern('/');
    assert.deepEqual(result, []);
  });

  it('解析静态路径', () => {
    const result = parsePattern('/users');
    assert.deepEqual(result, [
      { type: 'static', value: 'users' }
    ]);
  });

  it('解析多段静态路径', () => {
    const result = parsePattern('/api/users/export');
    assert.deepEqual(result, [
      { type: 'static', value: 'api' },
      { type: 'static', value: 'users' },
      { type: 'static', value: 'export' }
    ]);
  });

  it('解析带参数的路径', () => {
    const result = parsePattern('/users/:id');
    assert.deepEqual(result, [
      { type: 'static', value: 'users' },
      { type: 'param', name: 'id' }
    ]);
  });

  it('解析多个参数', () => {
    const result = parsePattern('/users/:userId/posts/:postId');
    assert.deepEqual(result, [
      { type: 'static', value: 'users' },
      { type: 'param', name: 'userId' },
      { type: 'static', value: 'posts' },
      { type: 'param', name: 'postId' }
    ]);
  });

  it('尾部斜杠被忽略', () => {
    const result = parsePattern('/users/');
    assert.deepEqual(result, [
      { type: 'static', value: 'users' }
    ]);
  });
});

// ==================== matchRoute 测试 ====================

describe('matchRoute - 路由匹配', () => {
  it('匹配根路径', () => {
    const segments = parsePattern('/');
    const params = matchRoute(segments, '/');
    assert.deepEqual(params, {});
  });

  it('匹配静态路径', () => {
    const segments = parsePattern('/users');
    assert.deepEqual(matchRoute(segments, '/users'), {});
    assert.equal(matchRoute(segments, '/other'), null);
    assert.equal(matchRoute(segments, '/users/1'), null); // 段数不同
  });

  it('匹配带参数的路径', () => {
    const segments = parsePattern('/users/:id');
    const params = matchRoute(segments, '/users/42');
    assert.deepEqual(params, { id: '42' });
  });

  it('参数值为字符串', () => {
    const segments = parsePattern('/users/:id');
    const params = matchRoute(segments, '/users/abc');
    assert.deepEqual(params, { id: 'abc' });
  });

  it('多个参数', () => {
    const segments = parsePattern('/users/:userId/posts/:postId');
    const params = matchRoute(segments, '/users/5/posts/10');
    assert.deepEqual(params, { userId: '5', postId: '10' });
  });

  it('段数不同不匹配', () => {
    const segments = parsePattern('/users/:id');
    assert.equal(matchRoute(segments, '/users'), null);
    assert.equal(matchRoute(segments, '/users/1/extra'), null);
  });

  it('静态段不匹配', () => {
    const segments = parsePattern('/users/:id');
    assert.equal(matchRoute(segments, '/posts/1'), null);
  });

  it('尾部斜杠兼容', () => {
    const segments = parsePattern('/users/:id');
    const params = matchRoute(segments, '/users/1/');
    assert.deepEqual(params, { id: '1' });
  });

  it('复杂路径匹配', () => {
    const segments = parsePattern('/api/v1/users/:id/comments');
    assert.deepEqual(matchRoute(segments, '/api/v1/users/99/comments'), { id: '99' });
    assert.equal(matchRoute(segments, '/api/v1/users/99'), null);
    assert.equal(matchRoute(segments, '/api/v2/users/99/comments'), null);
  });
});

// ==================== Router 核心测试 ====================

describe('Router - 路由器', () => {

  describe('路由注册', () => {
    it('注册 GET 路由', () => {
      const router = new Router();
      router.get('/users', () => {});
      assert.equal(router.routes.length, 1);
      assert.equal(router.routes[0].method, 'GET');
      assert.equal(router.routes[0].pattern, '/users');
    });

    it('注册 POST 路由', () => {
      const router = new Router();
      router.post('/users', () => {});
      assert.equal(router.routes[0].method, 'POST');
    });

    it('注册 PUT 路由', () => {
      const router = new Router();
      router.put('/users/:id', () => {});
      assert.equal(router.routes[0].method, 'PUT');
    });

    it('注册 DELETE 路由', () => {
      const router = new Router();
      router.delete('/users/:id', () => {});
      assert.equal(router.routes[0].method, 'DELETE');
    });

    it('注册 PATCH 路由', () => {
      const router = new Router();
      router.patch('/users/:id', () => {});
      assert.equal(router.routes[0].method, 'PATCH');
    });

    it('支持链式注册', () => {
      const router = new Router();
      const result = router
        .get('/users', () => {})
        .post('/users', () => {})
        .put('/users/:id', () => {});

      assert.equal(result, router);
      assert.equal(router.routes.length, 3);
    });
  });

  describe('handle() - 路由处理', () => {
    it('匹配并执行 GET 路由', () => {
      const router = new Router();
      let handled = false;

      router.get('/users', (req, res) => {
        handled = true;
      });

      const req = mockReq('GET', '/users');
      const res = mockRes();
      const result = router.handle('GET', '/users', req, res);

      assert.equal(result, true);
      assert.equal(handled, true);
    });

    it('匹配并执行带参数的路由', () => {
      const router = new Router();
      let capturedId = null;

      router.get('/users/:id', (req, res) => {
        capturedId = req.params.id;
      });

      const req = mockReq('GET', '/users/42');
      const res = mockRes();
      router.handle('GET', '/users/42', req, res);

      assert.equal(capturedId, '42');
    });

    it('HTTP 方法不匹配时返回 false', () => {
      const router = new Router();
      router.get('/users', () => {});

      const req = mockReq('POST', '/users');
      const res = mockRes();
      const result = router.handle('POST', '/users', req, res);

      assert.equal(result, false);
    });

    it('路径不匹配时返回 false', () => {
      const router = new Router();
      router.get('/users', () => {});

      const req = mockReq('GET', '/posts');
      const res = mockRes();
      const result = router.handle('GET', '/posts', req, res);

      assert.equal(result, false);
    });

    it('同一路径不同方法', () => {
      const router = new Router();
      let method = '';

      router.get('/users', (req, res) => { method = 'GET'; });
      router.post('/users', (req, res) => { method = 'POST'; });

      const req1 = mockReq('GET', '/users');
      router.handle('GET', '/users', req1, mockRes());
      assert.equal(method, 'GET');

      const req2 = mockReq('POST', '/users');
      router.handle('POST', '/users', req2, mockRes());
      assert.equal(method, 'POST');
    });

    it('优先匹配先注册的路由', () => {
      const router = new Router();
      let which = '';

      router.get('/users/export', (req, res) => { which = 'export'; });
      router.get('/users/:id', (req, res) => { which = 'detail'; });

      const req = mockReq('GET', '/users/export');
      router.handle('GET', '/users/export', req, mockRes());

      // /users/export 应该匹配第一个静态路由
      assert.equal(which, 'export');
    });

    it('静态路由和参数路由共存', () => {
      const router = new Router();
      let result = '';

      router.get('/users', (req, res) => { result = 'list'; });
      router.get('/users/:id', (req, res) => { result = `detail-${req.params.id}`; });

      let req = mockReq('GET', '/users');
      router.handle('GET', '/users', req, mockRes());
      assert.equal(result, 'list');

      req = mockReq('GET', '/users/5');
      router.handle('GET', '/users/5', req, mockRes());
      assert.equal(result, 'detail-5');
    });

    it('处理函数可以写入响应', () => {
      const router = new Router();

      router.get('/hello', (req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify({ hello: 'world' }));
      });

      const req = mockReq('GET', '/hello');
      const res = mockRes();
      router.handle('GET', '/hello', req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(JSON.parse(res.body), { hello: 'world' });
    });
  });

  describe('mount() - 子路由器挂载', () => {
    it('挂载子路由器到前缀', () => {
      const router = new Router();
      const authRouter = new Router();
      let handled = false;

      authRouter.post('/login', (req, res) => {
        handled = true;
      });

      router.mount('/auth', authRouter);

      const req = mockReq('POST', '/auth/login');
      const res = mockRes();
      const result = router.handle('POST', '/auth/login', req, res);

      assert.equal(result, true);
      assert.equal(handled, true);
    });

    it('子路由器路径参数正常工作', () => {
      const router = new Router();
      const accountRouter = new Router();
      let capturedId = null;

      accountRouter.delete('/accounts/:id', (req, res) => {
        capturedId = req.params.id;
      });

      router.mount('/auth', accountRouter);

      const req = mockReq('DELETE', '/auth/accounts/5');
      const res = mockRes();
      router.handle('DELETE', '/auth/accounts/5', req, res);

      assert.equal(capturedId, '5');
    });

    it('子路由器不匹配时返回 false', () => {
      const router = new Router();
      const authRouter = new Router();
      authRouter.post('/login', () => {});

      router.mount('/auth', authRouter);

      const req = mockReq('GET', '/auth/unknown');
      const res = mockRes();
      const result = router.handle('GET', '/auth/unknown', req, res);

      assert.equal(result, false);
    });

    it('mount 参数非 Router 实例时抛异常', () => {
      const router = new Router();
      assert.throws(() => router.mount('/api', {}), TypeError);
      assert.throws(() => router.mount('/api', 'not router'), TypeError);
    });

    it('多级嵌套路由器', () => {
      const root = new Router();
      const apiRouter = new Router();
      const v1Router = new Router();
      let result = '';

      v1Router.get('/users', (req, res) => { result = 'v1-users'; });

      apiRouter.mount('/v1', v1Router);
      root.mount('/api', apiRouter);

      const req = mockReq('GET', '/api/v1/users');
      const res = mockRes();
      root.handle('GET', '/api/v1/users', req, res);

      assert.equal(result, 'v1-users');
    });

    it('子路由器的根路径', () => {
      const router = new Router();
      const authRouter = new Router();
      let handled = false;

      authRouter.get('/', (req, res) => {
        handled = true;
      });

      router.mount('/auth', authRouter);

      const req = mockReq('GET', '/auth');
      const res = mockRes();
      router.handle('GET', '/auth', req, res);

      assert.equal(handled, true);
    });

    it('自有路由优先于子路由器', () => {
      const router = new Router();
      const childRouter = new Router();
      let which = '';

      router.get('/auth/special', (req, res) => { which = 'own'; });
      childRouter.get('/special', (req, res) => { which = 'child'; });
      router.mount('/auth', childRouter);

      const req = mockReq('GET', '/auth/special');
      const res = mockRes();
      router.handle('GET', '/auth/special', req, res);

      // 自有路由先匹配
      assert.equal(which, 'own');
    });

    it('支持链式挂载', () => {
      const router = new Router();
      const a = new Router();
      const b = new Router();

      const result = router.mount('/a', a).mount('/b', b);
      assert.equal(result, router);
      assert.equal(router.children.length, 2);
    });
  });

  describe('middleware() - 作为中间件使用', () => {
    it('返回中间件函数', () => {
      const router = new Router();
      const mw = router.middleware();
      assert.equal(typeof mw, 'function');
      assert.equal(mw.length, 3); // (req, res, next)
    });

    it('匹配路由时不调用 next', () => {
      const router = new Router();
      let handled = false;
      let nextCalled = false;

      router.get('/test', (req, res) => { handled = true; });

      const mw = router.middleware();
      const req = mockReq('GET', '/test');
      const res = mockRes();

      mw(req, res, () => { nextCalled = true; });

      assert.equal(handled, true);
      assert.equal(nextCalled, false);
    });

    it('不匹配路由时调用 next', () => {
      const router = new Router();
      let nextCalled = false;

      router.get('/test', () => {});

      const mw = router.middleware();
      const req = mockReq('GET', '/other');
      const res = mockRes();

      mw(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
    });
  });
});

// ==================== 综合场景测试 ====================

describe('Router - 综合场景', () => {
  it('模拟完整的 CRUD API', () => {
    const router = new Router();
    const responses = [];

    router.get('/items', (req, res) => {
      responses.push({ action: 'list' });
    });
    router.get('/items/:id', (req, res) => {
      responses.push({ action: 'get', id: req.params.id });
    });
    router.post('/items', (req, res) => {
      responses.push({ action: 'create' });
    });
    router.put('/items/:id', (req, res) => {
      responses.push({ action: 'update', id: req.params.id });
    });
    router.delete('/items/:id', (req, res) => {
      responses.push({ action: 'delete', id: req.params.id });
    });

    // 列表
    router.handle('GET', '/items', mockReq('GET', '/items'), mockRes());
    // 详情
    router.handle('GET', '/items/3', mockReq('GET', '/items/3'), mockRes());
    // 创建
    router.handle('POST', '/items', mockReq('POST', '/items'), mockRes());
    // 更新
    router.handle('PUT', '/items/3', mockReq('PUT', '/items/3'), mockRes());
    // 删除
    router.handle('DELETE', '/items/3', mockReq('DELETE', '/items/3'), mockRes());

    assert.deepEqual(responses, [
      { action: 'list' },
      { action: 'get', id: '3' },
      { action: 'create' },
      { action: 'update', id: '3' },
      { action: 'delete', id: '3' }
    ]);
  });

  it('模拟带子路由器的 API 服务', () => {
    const apiRouter = new Router();
    const userRouter = new Router();
    const authRouter = new Router();
    const results = [];

    userRouter.get('/users', (req, res) => { results.push('user-list'); });
    userRouter.get('/users/:id', (req, res) => { results.push(`user-${req.params.id}`); });

    authRouter.post('/login', (req, res) => { results.push('login'); });
    authRouter.post('/register', (req, res) => { results.push('register'); });

    apiRouter.mount('/auth', authRouter);
    // 将 userRouter 的路由合并到 apiRouter
    for (const route of userRouter.routes) {
      apiRouter._addRoute(route.method, route.pattern, route.handler);
    }

    // 测试
    apiRouter.handle('GET', '/users', mockReq('GET', '/users'), mockRes());
    apiRouter.handle('GET', '/users/7', mockReq('GET', '/users/7'), mockRes());
    apiRouter.handle('POST', '/auth/login', mockReq('POST', '/auth/login'), mockRes());
    apiRouter.handle('POST', '/auth/register', mockReq('POST', '/auth/register'), mockRes());

    assert.deepEqual(results, ['user-list', 'user-7', 'login', 'register']);
  });

  it('不匹配的路由全部返回 false', () => {
    const router = new Router();
    router.get('/users', () => {});

    assert.equal(router.handle('GET', '/nope', mockReq('GET', '/nope'), mockRes()), false);
    assert.equal(router.handle('POST', '/users', mockReq('POST', '/users'), mockRes()), false);
    assert.equal(router.handle('GET', '/users/1', mockReq('GET', '/users/1'), mockRes()), false);
  });

  it('路由处理函数可以访问 req.body', () => {
    const router = new Router();
    let receivedBody = null;

    router.post('/items', (req, res) => {
      receivedBody = req.body;
    });

    const req = mockReq('POST', '/items');
    req.body = { name: '测试', count: 5 };
    router.handle('POST', '/items', req, mockRes());

    assert.deepEqual(receivedBody, { name: '测试', count: 5 });
  });

  it('路由处理函数写入完整 HTTP 响应', () => {
    const router = new Router();

    router.get('/api/health', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: '2024-01-01' }));
    });

    const req = mockReq('GET', '/api/health');
    const res = mockRes();
    router.handle('GET', '/api/health', req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/json');
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
  });
});
