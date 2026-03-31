#!/usr/bin/env node

/**
 * 中间件引擎 (Middleware Engine)
 *
 * 设计思路：
 *   类似 Express/Koa 的中间件管道模式
 *   中间件按注册顺序执行，通过 next() 传递控制权
 *   支持全局中间件、路径级中间件、错误处理中间件
 *
 * 用法示例：
 *   const app = new MiddlewareEngine();
 *   app.use(logger);                        // 全局中间件
 *   app.use('/api', authMiddleware);         // 路径前缀中间件
 *   app.use(errorHandler);                  // 错误处理中间件（4个参数）
 */

class MiddlewareEngine {
  constructor() {
    /** @type {Array<{path: string, handler: Function}>} */
    this.stack = [];
  }

  /**
   * 注册中间件
   * @param {string|Function} pathOrHandler - 路径前缀 或 中间件函数
   * @param {Function} [handler] - 如果第一个参数是路径，则此为中间件函数
   *
   * 支持的签名：
   *   use(handler)          → 全局中间件，匹配所有路径
   *   use('/api', handler)  → 仅匹配 /api 开头的路径
   */
  use(pathOrHandler, handler) {
    if (typeof pathOrHandler === 'function') {
      // use(handler) — 全局中间件
      this.stack.push({ path: '/', handler: pathOrHandler });
    } else if (typeof pathOrHandler === 'string' && typeof handler === 'function') {
      // use('/path', handler) — 路径前缀中间件
      this.stack.push({ path: pathOrHandler, handler });
    } else {
      throw new TypeError('use() 参数无效：需要 use(fn) 或 use(path, fn)');
    }
    return this; // 支持链式调用
  }

  /**
   * 执行中间件管道
   * @param {object} req - HTTP 请求对象（需要有 pathname 属性，由调用方设置）
   * @param {object} res - HTTP 响应对象
   * @param {Function} [done] - 所有中间件执行完毕的回调
   */
  run(req, res, done) {
    let index = 0;
    const stack = this.stack;

    function next(err) {
      // 找到下一个匹配的中间件
      while (index < stack.length) {
        const layer = stack[index];
        index++;

        // 路径匹配：请求路径必须以中间件路径开头
        const pathname = req.pathname || req.url || '/';
        if (!pathMatch(pathname, layer.path)) {
          continue;
        }

        const fn = layer.handler;

        // 如果有错误，只交给错误处理中间件（4个参数）
        if (err) {
          if (fn.length === 4) {
            try {
              fn(err, req, res, next);
            } catch (e) {
              next(e);
            }
            return;
          }
          // 跳过普通中间件
          continue;
        }

        // 普通中间件（非错误处理）
        if (fn.length < 4) {
          try {
            fn(req, res, next);
          } catch (e) {
            next(e);
          }
          return;
        }

        // 跳过错误处理中间件（在没有错误时）
        continue;
      }

      // 所有中间件已执行完毕
      if (done) {
        done(err);
      }
    }

    next();
  }
}

/**
 * 路径匹配：检查 pathname 是否以 prefix 开头
 * - '/' 匹配所有路径
 * - '/api' 匹配 '/api', '/api/users', '/api/auth/login' 等
 * - 精确匹配或前缀+分隔符匹配
 */
function pathMatch(pathname, prefix) {
  if (prefix === '/') return true;

  // 标准化：去除尾部斜杠
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const normalizedPath = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;

  // 精确匹配
  if (normalizedPath === normalizedPrefix) return true;

  // 前缀匹配：pathname 以 prefix + '/' 开头
  if (normalizedPath.startsWith(normalizedPrefix + '/')) return true;

  return false;
}

// ==================== 内置中间件工厂 ====================

/**
 * 日志中间件：记录每个请求的方法、路径和耗时
 */
function loggerMiddleware(options = {}) {
  const prefix = options.prefix || '';
  return function logger(req, res, next) {
    const start = Date.now();
    const method = req.method;
    const path = req.pathname || req.url;

    // 在响应结束时记录
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode || 200;
      const timestamp = new Date().toLocaleTimeString('zh-CN');
      console.log(`${prefix}[${timestamp}] ${method} ${path} → ${statusCode} (${duration}ms)`);
      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * CORS 中间件：设置跨域响应头
 */
function corsMiddleware(options = {}) {
  const origin = options.origin || '*';
  const methods = options.methods || 'GET, POST, PUT, DELETE, OPTIONS';
  const headers = options.headers || 'Content-Type, Authorization';

  return function cors(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);

    // 预检请求直接返回
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    next();
  };
}

/**
 * JSON 请求体解析中间件：自动将 JSON 请求体解析到 req.body
 */
function bodyParserMiddleware(options = {}) {
  const limit = options.limit || 1024 * 1024; // 默认 1MB

  return function bodyParser(req, res, next) {
    // 只解析有 body 的请求
    if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD') {
      req.body = {};
      next();
      return;
    }

    let body = '';
    let size = 0;
    let finished = false;

    function done(err) {
      if (finished) return; // 防止重复调用
      finished = true;
      next(err);
    }

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.removeAllListeners('data');
        done(new Error('请求体超过大小限制'));
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      if (finished) return;
      if (!body) {
        req.body = {};
        done();
        return;
      }
      try {
        req.body = JSON.parse(body);
        done();
      } catch (e) {
        const error = new Error('无效的 JSON 格式');
        error.statusCode = 400;
        done(error);
      }
    });

    req.on('error', (err) => {
      done(err);
    });
  };
}

/**
 * 错误处理中间件：统一的错误响应
 */
function errorHandlerMiddleware() {
  return function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || '服务器内部错误';

    console.error(`[ERROR] ${req.method} ${req.pathname || req.url} → ${statusCode}: ${message}`);

    if (!res.headersSent) {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      res.end(JSON.stringify({
        success: false,
        message: message
      }, null, 2));
    }
  };
}

// ==================== 导出 ====================
module.exports = {
  MiddlewareEngine,
  pathMatch,
  // 内置中间件
  loggerMiddleware,
  corsMiddleware,
  bodyParserMiddleware,
  errorHandlerMiddleware
};
