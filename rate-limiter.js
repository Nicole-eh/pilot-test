#!/usr/bin/env node

/**
 * 速率限制模块 (Rate Limiter)
 *
 * 提供多种限流策略，防止 API 被滥用。
 *
 * 策略：
 *   1. 固定窗口 (Fixed Window)   — 在固定时间窗口内限制请求数
 *   2. 滑动窗口 (Sliding Window) — 基于时间戳的精确滑动窗口
 *   3. 令牌桶 (Token Bucket)     — 平滑限流，允许短时突发
 *
 * 用法示例：
 *   const limiter = new RateLimiter({ strategy: 'sliding-window', max: 100, windowMs: 60000 });
 *   app.use(rateLimitMiddleware(limiter));
 */

// ==================== 限流存储 ====================

/**
 * 内存存储 — 用 Map 保存每个 key 的限流状态
 * 支持定期清理过期条目，防止内存泄漏
 */
class MemoryStore {
  constructor() {
    /** @type {Map<string, object>} */
    this.store = new Map();
    this._cleanupTimer = null;
  }

  get(key) {
    return this.store.get(key) || null;
  }

  set(key, value) {
    this.store.set(key, value);
  }

  delete(key) {
    this.store.delete(key);
  }

  /** 获取所有条目 */
  entries() {
    return this.store.entries();
  }

  /** 当前存储的 key 数量 */
  get size() {
    return this.store.size;
  }

  /** 清除所有数据 */
  clear() {
    this.store.clear();
  }

  /**
   * 启动定期清理
   * @param {number} intervalMs - 清理间隔（毫秒）
   * @param {number} maxAgeMs - 超过此年龄的条目将被清理
   */
  startCleanup(intervalMs, maxAgeMs) {
    this.stopCleanup();
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (value.lastAccess && (now - value.lastAccess) > maxAgeMs) {
          this.store.delete(key);
        }
      }
    }, intervalMs);
    // 不阻止进程退出
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /** 停止定期清理 */
  stopCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

// ==================== 速率限制器 ====================

class RateLimiter {
  /**
   * @param {object} options
   * @param {string} [options.strategy='sliding-window'] - 策略: 'fixed-window' | 'sliding-window' | 'token-bucket'
   * @param {number} [options.max=100]        - 最大请求数 / 桶容量
   * @param {number} [options.windowMs=60000] - 时间窗口（毫秒），固定/滑动窗口用
   * @param {number} [options.refillRate]     - 令牌补充速率（个/秒），令牌桶用，默认 max/windowMs*1000
   * @param {Function} [options.keyGenerator] - 从 req 提取限流 key 的函数
   * @param {boolean} [options.autoCleanup=true] - 是否自动清理过期条目
   * @param {MemoryStore} [options.store]     - 自定义存储（用于测试）
   */
  constructor(options = {}) {
    this.strategy = options.strategy || 'sliding-window';
    this.max = options.max || 100;
    this.windowMs = options.windowMs || 60000;
    this.refillRate = options.refillRate || (this.max / this.windowMs * 1000);
    this.keyGenerator = options.keyGenerator || defaultKeyGenerator;
    this.store = options.store || new MemoryStore();

    // 验证策略
    const validStrategies = ['fixed-window', 'sliding-window', 'token-bucket'];
    if (!validStrategies.includes(this.strategy)) {
      throw new Error(`无效的限流策略: "${this.strategy}"。支持: ${validStrategies.join(', ')}`);
    }

    // 自动清理
    if (options.autoCleanup !== false && this.store instanceof MemoryStore) {
      this.store.startCleanup(
        Math.max(this.windowMs, 30000),  // 清理间隔至少 30 秒
        this.windowMs * 2                 // 2 倍窗口时间后清理
      );
    }
  }

  /**
   * 检查请求是否被允许
   * @param {string} key - 限流 key（通常是 IP 或用户 ID）
   * @returns {{ allowed: boolean, remaining: number, limit: number, resetTime: number, retryAfter: number }}
   */
  check(key) {
    switch (this.strategy) {
      case 'fixed-window':
        return this._checkFixedWindow(key);
      case 'sliding-window':
        return this._checkSlidingWindow(key);
      case 'token-bucket':
        return this._checkTokenBucket(key);
      default:
        return { allowed: true, remaining: this.max, limit: this.max, resetTime: 0, retryAfter: 0 };
    }
  }

  /**
   * 消费一次请求配额
   * @param {string} key
   * @returns {{ allowed: boolean, remaining: number, limit: number, resetTime: number, retryAfter: number }}
   */
  consume(key) {
    switch (this.strategy) {
      case 'fixed-window':
        return this._consumeFixedWindow(key);
      case 'sliding-window':
        return this._consumeSlidingWindow(key);
      case 'token-bucket':
        return this._consumeTokenBucket(key);
      default:
        return { allowed: true, remaining: this.max, limit: this.max, resetTime: 0, retryAfter: 0 };
    }
  }

  /**
   * 重置指定 key 的限流状态
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * 重置所有限流状态
   */
  resetAll() {
    this.store.clear();
  }

  /**
   * 销毁限流器，清理定时器
   */
  destroy() {
    if (this.store instanceof MemoryStore) {
      this.store.stopCleanup();
    }
  }

  // ==================== 固定窗口 ====================

  _checkFixedWindow(key) {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now >= record.resetTime) {
      return {
        allowed: true,
        remaining: this.max,
        limit: this.max,
        resetTime: now + this.windowMs,
        retryAfter: 0
      };
    }

    const remaining = Math.max(0, this.max - record.count);
    return {
      allowed: remaining > 0,
      remaining,
      limit: this.max,
      resetTime: record.resetTime,
      retryAfter: remaining > 0 ? 0 : Math.ceil((record.resetTime - now) / 1000)
    };
  }

  _consumeFixedWindow(key) {
    const now = Date.now();
    let record = this.store.get(key);

    // 窗口过期或不存在，创建新窗口
    if (!record || now >= record.resetTime) {
      record = {
        count: 0,
        resetTime: now + this.windowMs,
        lastAccess: now
      };
    }

    record.count++;
    record.lastAccess = now;
    this.store.set(key, record);

    const remaining = Math.max(0, this.max - record.count);
    const allowed = record.count <= this.max;

    return {
      allowed,
      remaining,
      limit: this.max,
      resetTime: record.resetTime,
      retryAfter: allowed ? 0 : Math.ceil((record.resetTime - now) / 1000)
    };
  }

  // ==================== 滑动窗口 ====================

  _checkSlidingWindow(key) {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record) {
      return {
        allowed: true,
        remaining: this.max,
        limit: this.max,
        resetTime: now + this.windowMs,
        retryAfter: 0
      };
    }

    // 清除过期的时间戳
    const windowStart = now - this.windowMs;
    const validTimestamps = record.timestamps.filter(ts => ts > windowStart);
    const remaining = Math.max(0, this.max - validTimestamps.length);

    return {
      allowed: remaining > 0,
      remaining,
      limit: this.max,
      resetTime: validTimestamps.length > 0 ? validTimestamps[0] + this.windowMs : now + this.windowMs,
      retryAfter: remaining > 0 ? 0 : Math.ceil((validTimestamps[0] + this.windowMs - now) / 1000)
    };
  }

  _consumeSlidingWindow(key) {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record) {
      record = { timestamps: [], lastAccess: now };
    }

    // 清除过期的时间戳
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    const allowed = record.timestamps.length < this.max;

    if (allowed) {
      record.timestamps.push(now);
    }

    record.lastAccess = now;
    this.store.set(key, record);

    const remaining = Math.max(0, this.max - record.timestamps.length);
    const resetTime = record.timestamps.length > 0 ? record.timestamps[0] + this.windowMs : now + this.windowMs;
    const retryAfter = allowed ? 0 : Math.ceil((record.timestamps[0] + this.windowMs - now) / 1000);

    return {
      allowed,
      remaining,
      limit: this.max,
      resetTime,
      retryAfter: Math.max(0, retryAfter)
    };
  }

  // ==================== 令牌桶 ====================

  _checkTokenBucket(key) {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record) {
      return {
        allowed: true,
        remaining: this.max,
        limit: this.max,
        resetTime: 0,
        retryAfter: 0
      };
    }

    // 计算当前令牌数
    const elapsed = (now - record.lastRefill) / 1000; // 秒
    const tokens = Math.min(this.max, record.tokens + elapsed * this.refillRate);
    const remaining = Math.floor(tokens);

    return {
      allowed: remaining >= 1,
      remaining,
      limit: this.max,
      resetTime: 0,
      retryAfter: remaining >= 1 ? 0 : Math.ceil((1 - tokens) / this.refillRate)
    };
  }

  _consumeTokenBucket(key) {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record) {
      record = {
        tokens: this.max,
        lastRefill: now,
        lastAccess: now
      };
    }

    // 补充令牌
    const elapsed = (now - record.lastRefill) / 1000; // 秒
    record.tokens = Math.min(this.max, record.tokens + elapsed * this.refillRate);
    record.lastRefill = now;
    record.lastAccess = now;

    const allowed = record.tokens >= 1;

    if (allowed) {
      record.tokens -= 1;
    }

    this.store.set(key, record);

    const remaining = Math.floor(record.tokens);

    return {
      allowed,
      remaining,
      limit: this.max,
      resetTime: 0,
      retryAfter: allowed ? 0 : Math.ceil((1 - record.tokens) / this.refillRate)
    };
  }
}

// ==================== 默认 Key 生成器 ====================

/**
 * 从请求中提取客户端标识（IP 地址）
 */
function defaultKeyGenerator(req) {
  // 优先使用代理头
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // 然后是 X-Real-IP
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  // 最后用 socket 地址
  return (req.socket && req.socket.remoteAddress) || req.connection && req.connection.remoteAddress || 'unknown';
}

// ==================== 速率限制中间件 ====================

/**
 * 创建速率限制中间件
 *
 * @param {RateLimiter|object} limiterOrOptions - RateLimiter 实例或配置对象
 * @param {object} [middlewareOptions]
 * @param {boolean} [middlewareOptions.setHeaders=true] - 是否设置 RateLimit 响应头
 * @param {Function} [middlewareOptions.onLimited] - 被限流时的自定义处理函数
 * @param {Function} [middlewareOptions.skip] - 跳过限流的判断函数
 *
 * @returns {Function} 中间件函数 (req, res, next)
 */
function rateLimitMiddleware(limiterOrOptions, middlewareOptions = {}) {
  let limiter;
  if (limiterOrOptions instanceof RateLimiter) {
    limiter = limiterOrOptions;
  } else {
    limiter = new RateLimiter(limiterOrOptions);
  }

  const setHeaders = middlewareOptions.setHeaders !== false;
  const onLimited = middlewareOptions.onLimited || null;
  const skip = middlewareOptions.skip || null;

  return function rateLimit(req, res, next) {
    // 跳过判断
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = limiter.keyGenerator(req);
    const result = limiter.consume(key);

    // 设置标准 RateLimit 响应头
    if (setHeaders) {
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      if (result.resetTime > 0) {
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      }
    }

    if (!result.allowed) {
      // 设置 Retry-After 头
      if (result.retryAfter > 0) {
        res.setHeader('Retry-After', result.retryAfter);
      }

      if (onLimited) {
        onLimited(req, res, next, result);
        return;
      }

      // 默认：返回 429 Too Many Requests
      res.writeHead(429, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      res.end(JSON.stringify({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: result.retryAfter
      }, null, 2));
      return;
    }

    next();
  };
}

// ==================== 路由级限流辅助 ====================

/**
 * 创建按路由分组的限流器
 * 允许为不同 API 端点设置不同的限流规则
 *
 * @param {object} routeConfigs - 路由限流配置
 *   key: 路由前缀（如 '/api/auth'）
 *   value: RateLimiter 配置对象
 * @param {object} defaultConfig - 默认限流配置
 *
 * @returns {Function} 中间件函数
 */
function routeRateLimiter(routeConfigs, defaultConfig = {}) {
  const limiters = {};
  let defaultLimiter = null;

  // 为每个路由创建独立的限流器
  for (const [route, config] of Object.entries(routeConfigs)) {
    limiters[route] = new RateLimiter({ autoCleanup: false, ...config });
  }

  if (Object.keys(defaultConfig).length > 0) {
    defaultLimiter = new RateLimiter({ autoCleanup: false, ...defaultConfig });
  }

  return function routeRateLimit(req, res, next) {
    const pathname = req.pathname || req.url || '/';

    // 找到匹配的路由限流器（最长前缀匹配）
    let matchedRoute = null;
    let matchedLength = 0;

    for (const route of Object.keys(limiters)) {
      if ((pathname === route || pathname.startsWith(route + '/')) && route.length > matchedLength) {
        matchedRoute = route;
        matchedLength = route.length;
      }
    }

    const limiter = matchedRoute ? limiters[matchedRoute] : defaultLimiter;

    if (!limiter) {
      next();
      return;
    }

    const key = limiter.keyGenerator(req);
    const result = limiter.consume(key);

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      if (result.retryAfter > 0) {
        res.setHeader('Retry-After', result.retryAfter);
      }
      res.writeHead(429, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      res.end(JSON.stringify({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: result.retryAfter
      }, null, 2));
      return;
    }

    next();
  };
}

// ==================== 导出 ====================
module.exports = {
  RateLimiter,
  MemoryStore,
  rateLimitMiddleware,
  routeRateLimiter,
  defaultKeyGenerator
};
