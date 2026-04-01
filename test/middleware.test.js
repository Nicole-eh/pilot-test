const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MiddlewareEngine, pathMatch, loggerMiddleware, corsMiddleware, bodyParserMiddleware, errorHandlerMiddleware } = require('../middleware');
const { Readable } = require('stream');

// ==================== 辅助工具 ====================

/** 创建模拟 req 对象 */
function mockReq(options = {}) {
  const req = new Readable({ read() {} });
  req.method = options.method || 'GET';
  req.url = options.url || '/';
  req.pathname = options.pathname || options.url || '/';
  req.headers = options.headers || {};
  return req;
}

/** 创建模拟 res 对象 */
function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    headersSent: false,
    writeHead(code, headers) {
      res.statusCode = code;
      if (headers) Object.assign(res.headers, headers);
      res.headersSent = true;
    },
    setHeader(key, value) {
      res.headers[key] = value;
    },
    end(data) {
      if (data) res.body = data;
      res.headersSent = true;
    }
  };
  return res;
}

// ==================== pathMatch 测试 ====================

describe('pathMatch - 路径匹配函数', () => {
  it('根路径 "/" 匹配所有路径', () => {
    assert.equal(pathMatch('/', '/'), true);
    assert.equal(pathMatch('/api', '/'), true);
    assert.equal(pathMatch('/api/users', '/'), true);
    assert.equal(pathMatch('/anything/deep/nested', '/'), true);
  });

  it('精确匹配', () => {
    assert.equal(pathMatch('/api', '/api'), true);
    assert.equal(pathMatch('/api/users', '/api/users'), true);
  });

  it('前缀匹配', () => {
    assert.equal(pathMatch('/api/users', '/api'), true);
    assert.equal(pathMatch('/api/users/1', '/api'), true);
    assert.equal(pathMatch('/api/auth/login', '/api'), true);
  });

  it('不匹配不相关的路径', () => {
    assert.equal(pathMatch('/other', '/api'), false);
    assert.equal(pathMatch('/ap', '/api'), false);
    assert.equal(pathMatch('/apifoo', '/api'), false); // 不是前缀+分隔符
  });

  it('尾部斜杠处理', () => {
    assert.equal(pathMatch('/api/', '/api'), true);
    assert.equal(pathMatch('/api', '/api/'), true);
    assert.equal(pathMatch('/api/', '/api/'), true);
  });

  it('根路径精确匹配', () => {
    assert.equal(pathMatch('/', '/'), true);
  });
});

// ==================== MiddlewareEngine 核心测试 ====================

describe('MiddlewareEngine - 中间件引擎', () => {

  describe('use() - 注册中间件', () => {
    it('注册全局中间件（仅传函数）', () => {
      const engine = new MiddlewareEngine();
      engine.use((req, res, next) => next());
      assert.equal(engine.stack.length, 1);
      assert.equal(engine.stack[0].path, '/');
    });

    it('注册路径中间件（传路径+函数）', () => {
      const engine = new MiddlewareEngine();
      engine.use('/api', (req, res, next) => next());
      assert.equal(engine.stack.length, 1);
      assert.equal(engine.stack[0].path, '/api');
    });

    it('支持链式调用', () => {
      const engine = new MiddlewareEngine();
      const result = engine
        .use((req, res, next) => next())
        .use('/api', (req, res, next) => next());
      assert.equal(result, engine);
      assert.equal(engine.stack.length, 2);
    });

    it('参数无效时抛出 TypeError', () => {
      const engine = new MiddlewareEngine();
      assert.throws(() => engine.use(123), TypeError);
      assert.throws(() => engine.use('/path', 'not a function'), TypeError);
      assert.throws(() => engine.use(null), TypeError);
    });
  });

  describe('run() - 中间件管道执行', () => {
    it('按注册顺序执行中间件', () => {
      const engine = new MiddlewareEngine();
      const order = [];

      engine.use((req, res, next) => { order.push(1); next(); });
      engine.use((req, res, next) => { order.push(2); next(); });
      engine.use((req, res, next) => { order.push(3); next(); });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res, () => {
        assert.deepEqual(order, [1, 2, 3]);
      });
    });

    it('中间件可以终止管道（不调用 next）', () => {
      const engine = new MiddlewareEngine();
      const order = [];

      engine.use((req, res, next) => { order.push(1); next(); });
      engine.use((req, res, next) => { order.push(2); /* 不调用 next */ });
      engine.use((req, res, next) => { order.push(3); next(); });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.deepEqual(order, [1, 2]);
    });

    it('路径中间件只在路径匹配时执行', () => {
      const engine = new MiddlewareEngine();
      const order = [];

      engine.use((req, res, next) => { order.push('global'); next(); });
      engine.use('/api', (req, res, next) => { order.push('api'); next(); });
      engine.use('/admin', (req, res, next) => { order.push('admin'); next(); });

      const req = mockReq({ pathname: '/api/users' });
      const res = mockRes();
      engine.run(req, res, () => {
        assert.deepEqual(order, ['global', 'api']);
      });
    });

    it('所有中间件执行完后调用 done 回调', () => {
      const engine = new MiddlewareEngine();
      let doneCalled = false;

      engine.use((req, res, next) => next());

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res, () => {
        doneCalled = true;
      });

      assert.equal(doneCalled, true);
    });

    it('空中间件栈直接调用 done', () => {
      const engine = new MiddlewareEngine();
      let doneCalled = false;

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res, () => {
        doneCalled = true;
      });

      assert.equal(doneCalled, true);
    });

    it('没有 done 回调也不报错', () => {
      const engine = new MiddlewareEngine();
      engine.use((req, res, next) => next());

      const req = mockReq();
      const res = mockRes();
      assert.doesNotThrow(() => engine.run(req, res));
    });
  });

  describe('错误处理', () => {
    it('中间件抛出异常时传递给错误处理中间件', () => {
      const engine = new MiddlewareEngine();
      let capturedError = null;

      engine.use((req, res, next) => {
        throw new Error('测试异常');
      });
      engine.use((err, req, res, next) => {
        capturedError = err;
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.notEqual(capturedError, null);
      assert.equal(capturedError.message, '测试异常');
    });

    it('next(err) 手动传递错误', () => {
      const engine = new MiddlewareEngine();
      let capturedError = null;

      engine.use((req, res, next) => {
        next(new Error('手动错误'));
      });
      engine.use((err, req, res, next) => {
        capturedError = err;
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.notEqual(capturedError, null);
      assert.equal(capturedError.message, '手动错误');
    });

    it('有错误时跳过普通中间件', () => {
      const engine = new MiddlewareEngine();
      let normalCalled = false;
      let errorCalled = false;

      engine.use((req, res, next) => {
        next(new Error('错误'));
      });
      engine.use((req, res, next) => {
        normalCalled = true;
        next();
      });
      engine.use((err, req, res, next) => {
        errorCalled = true;
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.equal(normalCalled, false);
      assert.equal(errorCalled, true);
    });

    it('没有错误时跳过错误处理中间件', () => {
      const engine = new MiddlewareEngine();
      let errorHandlerCalled = false;
      let normalCalled = false;

      engine.use((err, req, res, next) => {
        errorHandlerCalled = true;
        next();
      });
      engine.use((req, res, next) => {
        normalCalled = true;
        next();
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.equal(errorHandlerCalled, false);
      assert.equal(normalCalled, true);
    });

    it('错误处理中间件可以通过 next() 恢复正常流程', () => {
      const engine = new MiddlewareEngine();
      const order = [];

      engine.use((req, res, next) => {
        next(new Error('错误'));
      });
      engine.use((err, req, res, next) => {
        order.push('error-handler');
        next(); // 不传 err，恢复正常
      });
      engine.use((req, res, next) => {
        order.push('recovered');
        next();
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res, () => {
        assert.deepEqual(order, ['error-handler', 'recovered']);
      });
    });

    it('错误处理中间件抛出异常时传递给下一个错误处理', () => {
      const engine = new MiddlewareEngine();
      let finalError = null;

      engine.use((req, res, next) => {
        next(new Error('原始错误'));
      });
      engine.use((err, req, res, next) => {
        throw new Error('二次错误');
      });
      engine.use((err, req, res, next) => {
        finalError = err;
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.notEqual(finalError, null);
      assert.equal(finalError.message, '二次错误');
    });

    it('未被捕获的错误传递给 done 回调', () => {
      const engine = new MiddlewareEngine();
      let doneError = null;

      engine.use((req, res, next) => {
        next(new Error('未捕获'));
      });
      // 没有错误处理中间件

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res, (err) => {
        doneError = err;
      });

      assert.notEqual(doneError, null);
      assert.equal(doneError.message, '未捕获');
    });
  });

  describe('中间件可修改 req/res', () => {
    it('前序中间件为 req 添加属性，后续中间件可见', () => {
      const engine = new MiddlewareEngine();

      engine.use((req, res, next) => {
        req.customData = '自定义数据';
        next();
      });
      engine.use((req, res, next) => {
        assert.equal(req.customData, '自定义数据');
        next();
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);
    });

    it('中间件可以拦截并修改响应', () => {
      const engine = new MiddlewareEngine();

      engine.use((req, res, next) => {
        res.statusCode = 201;
        res.body = '已创建';
        // 不调用 next，终止管道
      });

      const req = mockReq();
      const res = mockRes();
      engine.run(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body, '已创建');
    });
  });
});

// ==================== 内置中间件测试 ====================

describe('corsMiddleware - CORS 中间件', () => {
  it('设置默认 CORS 头', () => {
    const cors = corsMiddleware();
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    cors(req, res, () => {});

    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    assert.ok(res.headers['Access-Control-Allow-Methods'].includes('GET'));
    assert.ok(res.headers['Access-Control-Allow-Headers'].includes('Content-Type'));
  });

  it('OPTIONS 预检请求直接返回 204', () => {
    const cors = corsMiddleware();
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    let nextCalled = false;

    cors(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 204);
    assert.equal(nextCalled, false);
  });

  it('自定义 CORS 配置', () => {
    const cors = corsMiddleware({
      origin: 'https://example.com',
      methods: 'GET, POST',
      headers: 'X-Custom-Header'
    });
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    cors(req, res, () => {});

    assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://example.com');
    assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST');
    assert.equal(res.headers['Access-Control-Allow-Headers'], 'X-Custom-Header');
  });

  it('非 OPTIONS 请求正常调用 next', () => {
    const cors = corsMiddleware();
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    let nextCalled = false;

    cors(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
  });
});

describe('bodyParserMiddleware - JSON 解析中间件', () => {
  it('GET 请求设置空 body 并调用 next', () => {
    const parser = bodyParserMiddleware();
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    let nextCalled = false;

    parser(req, res, () => { nextCalled = true; });

    assert.deepEqual(req.body, {});
    assert.equal(nextCalled, true);
  });

  it('解析合法 JSON 请求体', (_, done) => {
    const parser = bodyParserMiddleware();
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    parser(req, res, () => {
      assert.deepEqual(req.body, { name: '张三', age: 25 });
      done();
    });

    // 模拟发送数据
    req.push(JSON.stringify({ name: '张三', age: 25 }));
    req.push(null); // 结束流
  });

  it('空请求体设置为空对象', (_, done) => {
    const parser = bodyParserMiddleware();
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    parser(req, res, () => {
      assert.deepEqual(req.body, {});
      done();
    });

    req.push(null);
  });

  it('非法 JSON 调用 next(error)', (_, done) => {
    const parser = bodyParserMiddleware();
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    parser(req, res, (err) => {
      assert.notEqual(err, undefined);
      assert.ok(err.message.includes('JSON'));
      assert.equal(err.statusCode, 400);
      done();
    });

    req.push('这不是JSON{{{');
    req.push(null);
  });

  it('超过大小限制调用 next(error)', (_, done) => {
    const parser = bodyParserMiddleware({ limit: 10 }); // 10 字节限制
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    parser(req, res, (err) => {
      assert.notEqual(err, undefined);
      assert.ok(err.message.includes('大小限制'));
      done();
    });

    req.push('a'.repeat(20));
    req.push(null);
  });

  it('DELETE 请求也设置空 body', () => {
    const parser = bodyParserMiddleware();
    const req = mockReq({ method: 'DELETE' });
    const res = mockRes();
    let nextCalled = false;

    parser(req, res, () => { nextCalled = true; });

    assert.deepEqual(req.body, {});
    assert.equal(nextCalled, true);
  });
});

describe('errorHandlerMiddleware - 错误处理中间件', () => {
  it('返回 500 错误和 JSON 响应', () => {
    const handler = errorHandlerMiddleware();
    const err = new Error('服务器挂了');
    const req = mockReq({ method: 'GET', pathname: '/test' });
    const res = mockRes();

    handler(err, req, res, () => {});

    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.message, '服务器挂了');
  });

  it('使用 err.statusCode 作为状态码', () => {
    const handler = errorHandlerMiddleware();
    const err = new Error('找不到');
    err.statusCode = 404;
    const req = mockReq({ method: 'GET', pathname: '/test' });
    const res = mockRes();

    handler(err, req, res, () => {});

    assert.equal(res.statusCode, 404);
  });

  it('响应头已发送时不再写入', () => {
    const handler = errorHandlerMiddleware();
    const err = new Error('错误');
    const req = mockReq({ method: 'GET', pathname: '/test' });
    const res = mockRes();
    res.headersSent = true;

    // 不应抛出错误
    assert.doesNotThrow(() => handler(err, req, res, () => {}));
  });
});

describe('loggerMiddleware - 日志中间件', () => {
  it('包装 res.end 记录日志', () => {
    const logger = loggerMiddleware({ prefix: '[TEST] ' });
    const req = mockReq({ method: 'GET', pathname: '/api/users' });
    const res = mockRes();
    let nextCalled = false;

    logger(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    // 验证 res.end 被包装
    assert.equal(typeof res.end, 'function');
  });

  it('调用 res.end 后仍然正常结束响应', () => {
    const logger = loggerMiddleware();
    const req = mockReq({ method: 'GET', pathname: '/test' });
    const res = mockRes();

    logger(req, res, () => {});

    // 调用包装后的 end
    res.end('done');
    assert.equal(res.body, 'done');
  });
});

// ==================== 组合场景测试 ====================

describe('MiddlewareEngine - 组合场景', () => {
  it('完整请求管道：CORS → 自定义 → 响应', () => {
    const engine = new MiddlewareEngine();

    engine.use(corsMiddleware());
    engine.use((req, res, next) => {
      req.processed = true;
      next();
    });
    engine.use((req, res, next) => {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, processed: req.processed }));
    });

    const req = mockReq({ method: 'GET', pathname: '/' });
    const res = mockRes();
    engine.run(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.processed, true);
  });

  it('路径级中间件不影响其他路径', () => {
    const engine = new MiddlewareEngine();
    let apiMiddlewareCalled = false;
    let responseValue = '';

    engine.use('/api', (req, res, next) => {
      apiMiddlewareCalled = true;
      next();
    });
    engine.use((req, res, next) => {
      responseValue = 'handled';
      next();
    });

    // 请求非 /api 路径
    const req = mockReq({ pathname: '/home' });
    const res = mockRes();
    engine.run(req, res);

    assert.equal(apiMiddlewareCalled, false);
    assert.equal(responseValue, 'handled');
  });

  it('错误处理完整流程', () => {
    const engine = new MiddlewareEngine();
    let result = {};

    engine.use((req, res, next) => {
      const err = new Error('故意出错');
      err.statusCode = 422;
      next(err);
    });
    engine.use((req, res, next) => {
      result.skipped = true; // 不应执行
      next();
    });
    engine.use((err, req, res, next) => {
      result.errorCaught = true;
      result.message = err.message;
      result.statusCode = err.statusCode;
    });

    const req = mockReq({ pathname: '/api/test' });
    const res = mockRes();
    engine.run(req, res);

    assert.equal(result.skipped, undefined);
    assert.equal(result.errorCaught, true);
    assert.equal(result.message, '故意出错');
    assert.equal(result.statusCode, 422);
  });

  it('多个路径级中间件按序执行', () => {
    const engine = new MiddlewareEngine();
    const order = [];

    engine.use('/api', (req, res, next) => { order.push('api-1'); next(); });
    engine.use('/api', (req, res, next) => { order.push('api-2'); next(); });
    engine.use('/api/auth', (req, res, next) => { order.push('auth'); next(); });

    const req = mockReq({ pathname: '/api/auth/login' });
    const res = mockRes();
    engine.run(req, res, () => {
      assert.deepEqual(order, ['api-1', 'api-2', 'auth']);
    });
  });
});
