#!/usr/bin/env node

/**
 * 路由器 (Router)
 *
 * 设计思路：
 *   支持 RESTful 风格路由注册 (GET/POST/PUT/DELETE/PATCH)
 *   支持路径参数（/users/:id → req.params.id）
 *   支持路由分组 / 挂载前缀
 *   可作为中间件挂载到 MiddlewareEngine
 *
 * 用法示例：
 *   const router = new Router();
 *   router.get('/users', listHandler);
 *   router.get('/users/:id', detailHandler);
 *   router.post('/users', createHandler);
 *
 *   // 分组
 *   const authRouter = new Router();
 *   authRouter.post('/login', loginHandler);
 *   router.mount('/auth', authRouter);
 *
 *   // 挂载到中间件引擎
 *   app.use('/api', router.routes());
 */

class Router {
  constructor() {
    /** @type {Array<{method: string, pattern: string, segments: Array, handler: Function}>} */
    this.routes = [];

    /** @type {Array<{prefix: string, router: Router}>} */
    this.children = [];
  }

  /**
   * 注册路由
   * @param {string} method - HTTP 方法（大写）
   * @param {string} pattern - 路由路径（支持 :param 参数）
   * @param {Function} handler - 路由处理函数 (req, res) => {}
   */
  _addRoute(method, pattern, handler) {
    const segments = parsePattern(pattern);
    this.routes.push({ method: method.toUpperCase(), pattern, segments, handler });
    return this;
  }

  /** GET 路由 */
  get(pattern, handler) {
    return this._addRoute('GET', pattern, handler);
  }

  /** POST 路由 */
  post(pattern, handler) {
    return this._addRoute('POST', pattern, handler);
  }

  /** PUT 路由 */
  put(pattern, handler) {
    return this._addRoute('PUT', pattern, handler);
  }

  /** DELETE 路由 */
  delete(pattern, handler) {
    return this._addRoute('DELETE', pattern, handler);
  }

  /** PATCH 路由 */
  patch(pattern, handler) {
    return this._addRoute('PATCH', pattern, handler);
  }

  /**
   * 挂载子路由器到指定前缀
   * @param {string} prefix - 路径前缀，如 '/auth'
   * @param {Router} childRouter - 子路由器实例
   */
  mount(prefix, childRouter) {
    if (!(childRouter instanceof Router)) {
      throw new TypeError('mount() 的第二个参数必须是 Router 实例');
    }
    this.children.push({ prefix: normalizePath(prefix), router: childRouter });
    return this;
  }

  /**
   * 尝试匹配并执行路由
   * @param {string} method - HTTP 方法
   * @param {string} pathname - 请求路径
   * @param {object} req - 请求对象
   * @param {object} res - 响应对象
   * @returns {boolean} 是否匹配到路由
   */
  handle(method, pathname, req, res) {
    const normalizedPath = normalizePath(pathname);

    // 1. 先匹配自己的路由
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;

      const params = matchRoute(route.segments, normalizedPath);
      if (params !== null) {
        req.params = params;
        route.handler(req, res);
        return true;
      }
    }

    // 2. 再匹配子路由器
    for (const child of this.children) {
      if (normalizedPath === child.prefix || normalizedPath.startsWith(child.prefix + '/')) {
        // 剥离前缀后交给子路由器
        const subPath = normalizedPath.slice(child.prefix.length) || '/';
        if (child.router.handle(method, subPath, req, res)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 将路由器转换为中间件函数
   * 可以直接挂载到 MiddlewareEngine：app.use('/api', router.routes())
   *
   * @returns {Function} 中间件函数
   */
  middleware() {
    const self = this;
    return function routerMiddleware(req, res, next) {
      const pathname = req.pathname || req.url || '/';
      const method = req.method;

      // 如果请求被中间件引擎挂载到某个前缀下，
      // req.pathname 已经是完整路径，需要剥离挂载前缀
      // 这里使用 req.routerBasePath 来记录已剥离的前缀
      const basePath = req.routerBasePath || '';
      const routePath = basePath ? pathname.slice(basePath.length) || '/' : pathname;

      if (self.handle(method, routePath, req, res)) {
        // 路由已处理
        return;
      }

      // 没有匹配的路由，传给下一个中间件
      next();
    };
  }
}

// ==================== 路径解析工具 ====================

/**
 * 标准化路径：去除尾部斜杠（保留根路径）
 */
function normalizePath(p) {
  if (!p || p === '/') return '/';
  return p.endsWith('/') ? p.slice(0, -1) : p;
}

/**
 * 解析路由模式为 segment 数组
 * '/users/:id/posts' → [{type:'static', value:'users'}, {type:'param', name:'id'}, {type:'static', value:'posts'}]
 */
function parsePattern(pattern) {
  const normalized = normalizePath(pattern);
  if (normalized === '/') return [];

  const parts = normalized.split('/').filter(Boolean);
  return parts.map(part => {
    if (part.startsWith(':')) {
      return { type: 'param', name: part.slice(1) };
    }
    return { type: 'static', value: part };
  });
}

/**
 * 尝试将请求路径与路由 segments 匹配
 * @returns {object|null} 匹配成功返回 params 对象，失败返回 null
 */
function matchRoute(segments, pathname) {
  const normalized = normalizePath(pathname);
  const parts = normalized === '/' ? [] : normalized.split('/').filter(Boolean);

  // 段数必须相同
  if (parts.length !== segments.length) return null;

  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const part = parts[i];

    if (seg.type === 'static') {
      if (seg.value !== part) return null;
    } else if (seg.type === 'param') {
      params[seg.name] = part;
    }
  }

  return params;
}

// ==================== 导出 ====================
module.exports = {
  Router,
  normalizePath,
  parsePattern,
  matchRoute
};
