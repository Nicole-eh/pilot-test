#!/usr/bin/env node

/**
 * 请求限流模块（Rate Limiter）
 *
 * 基于滑动窗口算法的内存限流器，零外部依赖。
 *
 * 特性：
 * 1. 按 IP 地址限流（防止单个客户端滥用）
 * 2. 按端点分组限流（对敏感端点如登录/注册施加更严格的限制）
 * 3. 全局限流（保护服务器整体吞吐量）
 * 4. 自动清理过期记录（防止内存泄漏）
 * 5. 标准 HTTP 响应头（RateLimit-* / Retry-After）
 */

// ==================== 滑动窗口计数器 ====================

class SlidingWindowCounter {
  /**
   * @param {number} windowMs   - 时间窗口大小（毫秒）
   * @param {number} maxHits    - 窗口内允许的最大请求数
   */
  constructor(windowMs, maxHits) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
    /** @type {Map<string, number[]>} key -> timestamps */
    this._buckets = new Map();
  }

  /**
   * 尝试消费一次配额
   * @param {string} key - 限流维度的唯一标识（如 IP 地址）
   * @returns {{ allowed: boolean, remaining: number, resetMs: number, total: number }}
   */
  hit(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 获取或创建该 key 的时间戳数组
    let timestamps = this._buckets.get(key);
    if (!timestamps) {
      timestamps = [];
      this._buckets.set(key, timestamps);
    }

    // 清除过期的时间戳（滑动窗口）
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }

    const currentCount = timestamps.length;

    if (currentCount >= this.maxHits) {
      // 已达上限，计算需要等待多久
      const oldestInWindow = timestamps[0];
      const resetMs = oldestInWindow + this.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(resetMs, 0),
        total: this.maxHits
      };
    }

    // 记录本次请求
    timestamps.push(now);

    return {
      allowed: true,
      remaining: this.maxHits - timestamps.length,
      resetMs: this.windowMs,
      total: this.maxHits
    };
  }

  /**
   * 获取某个 key 当前剩余配额（不消费）
   */
  peek(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this._buckets.get(key);
    if (!timestamps) {
      return { remaining: this.maxHits, total: this.maxHits };
    }

    // 计算窗口内有效请求数
    let validCount = 0;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] > windowStart) {
        validCount++;
      } else {
        break;
      }
    }

    return {
      remaining: Math.max(this.maxHits - validCount, 0),
      total: this.maxHits
    };
  }

  /**
   * 清理所有过期数据，防止内存泄漏
   * @returns {number} 清理的 key 数量
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;

    for (const [key, timestamps] of this._buckets.entries()) {
      // 清除过期时间戳
      while (timestamps.length > 0 && timestamps[0] <= windowStart) {
        timestamps.shift();
      }
      // 如果该 key 已无有效记录，移除整个 key
      if (timestamps.length === 0) {
        this._buckets.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 重置某个 key 的计数
   */
  reset(key) {
    this._buckets.delete(key);
  }

  /**
   * 当前跟踪的 key 数量
   */
  get size() {
    return this._buckets.size;
  }
}

// ==================== 限流规则配置 ====================

/**
 * 默认限流配置
 * 可通过 createRateLimiter(customConfig) 覆盖
 */
const DEFAULT_CONFIG = {
  // 全局限流：所有 IP 共享
  global: {
    windowMs: 60 * 1000,     // 1 分钟
    maxHits: 300,             // 每分钟最多 300 个请求（所有客户端合计）
    enabled: true
  },

  // 按 IP 限流：每个 IP 独立计数
  perIP: {
    windowMs: 60 * 1000,     // 1 分钟
    maxHits: 60,              // 每个 IP 每分钟最多 60 个请求
    enabled: true
  },

  // 按端点分组限流（更精细的控制）
  // key 是路径前缀，会自动匹配
  endpoints: {
    // 登录接口：防暴力破解
    '/api/auth/login': {
      windowMs: 15 * 60 * 1000,  // 15 分钟
      maxHits: 10,                // 15 分钟内最多 10 次登录尝试
      enabled: true
    },
    // 注册接口：防批量注册
    '/api/auth/register': {
      windowMs: 60 * 60 * 1000,  // 1 小时
      maxHits: 5,                 // 每小时最多注册 5 次
      enabled: true
    },
    // 通用 API 接口
    '/api': {
      windowMs: 60 * 1000,       // 1 分钟
      maxHits: 40,                // 每个 IP 每分钟最多 40 次 API 调用
      enabled: true
    }
  },

  // 自动清理间隔（毫秒）
  cleanupIntervalMs: 60 * 1000,  // 每分钟清理一次过期数据

  // 白名单 IP（不受限流，如健康检查探针）
  whitelist: ['127.0.0.1'],

  // 是否信任代理的 X-Forwarded-For 头
  trustProxy: false
};

// ==================== 主限流器 ====================

class RateLimiter {
  /**
   * @param {object} config - 限流配置（会与 DEFAULT_CONFIG 合并）
   */
  constructor(config = {}) {
    this.config = this._mergeConfig(DEFAULT_CONFIG, config);

    // 创建全局计数器
    this.globalCounter = new SlidingWindowCounter(
      this.config.global.windowMs,
      this.config.global.maxHits
    );

    // 创建 per-IP 计数器
    this.ipCounter = new SlidingWindowCounter(
      this.config.perIP.windowMs,
      this.config.perIP.maxHits
    );

    // 创建端点级别计数器（每个端点一个独立计数器）
    this.endpointCounters = {};
    for (const [path, rule] of Object.entries(this.config.endpoints)) {
      if (rule.enabled) {
        this.endpointCounters[path] = new SlidingWindowCounter(
          rule.windowMs,
          rule.maxHits
        );
      }
    }

    // 统计信息
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      startedAt: new Date().toISOString()
    };

    // 启动自动清理定时器
    this._cleanupTimer = null;
    if (this.config.cleanupIntervalMs > 0) {
      this._startCleanup();
    }
  }

  /**
   * 深度合并配置
   */
  _mergeConfig(defaults, overrides) {
    const result = { ...defaults };

    if (overrides.global) {
      result.global = { ...defaults.global, ...overrides.global };
    }
    if (overrides.perIP) {
      result.perIP = { ...defaults.perIP, ...overrides.perIP };
    }
    if (overrides.endpoints) {
      result.endpoints = { ...defaults.endpoints, ...overrides.endpoints };
    }
    if (overrides.cleanupIntervalMs !== undefined) {
      result.cleanupIntervalMs = overrides.cleanupIntervalMs;
    }
    if (overrides.whitelist) {
      result.whitelist = overrides.whitelist;
    }
    if (overrides.trustProxy !== undefined) {
      result.trustProxy = overrides.trustProxy;
    }

    return result;
  }

  /**
   * 启动定时清理
   */
  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // 允许 Node.js 进程正常退出（不因定时器阻塞）
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * 清理所有计数器中的过期数据
   */
  cleanup() {
    let totalCleaned = 0;
    totalCleaned += this.globalCounter.cleanup();
    totalCleaned += this.ipCounter.cleanup();
    for (const counter of Object.values(this.endpointCounters)) {
      totalCleaned += counter.cleanup();
    }
    return totalCleaned;
  }

  /**
   * 从请求中提取客户端 IP
   */
  getClientIP(req) {
    if (this.config.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        // 取第一个 IP（最原始的客户端）
        return forwarded.split(',')[0].trim();
      }
      const realIP = req.headers['x-real-ip'];
      if (realIP) {
        return realIP.trim();
      }
    }
    // 直连 IP
    return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * 匹配请求路径对应的端点规则
   * 按路径长度降序匹配（最具体的规则优先）
   */
  _matchEndpoint(pathname) {
    const paths = Object.keys(this.endpointCounters)
      .filter(p => pathname.startsWith(p))
      .sort((a, b) => b.length - a.length); // 最长匹配优先

    return paths.length > 0 ? paths[0] : null;
  }

  /**
   * 核心方法：检查请求是否被允许
   * @param {string} ip - 客户端 IP
   * @param {string} pathname - 请求路径
   * @returns {{ allowed: boolean, reason?: string, retryAfterMs?: number, headers: object }}
   */
  check(ip, pathname) {
    this.stats.totalRequests++;

    // 白名单检查
    if (this.config.whitelist.includes(ip)) {
      return {
        allowed: true,
        headers: this._buildHeaders(null, 'whitelist')
      };
    }

    // 1. 全局限流检查
    if (this.config.global.enabled) {
      const globalResult = this.globalCounter.hit('__global__');
      if (!globalResult.allowed) {
        this.stats.blockedRequests++;
        return {
          allowed: false,
          reason: 'global',
          retryAfterMs: globalResult.resetMs,
          headers: this._buildHeaders(globalResult, 'global')
        };
      }
    }

    // 2. 按 IP 限流检查
    if (this.config.perIP.enabled) {
      const ipResult = this.ipCounter.hit(ip);
      if (!ipResult.allowed) {
        this.stats.blockedRequests++;
        return {
          allowed: false,
          reason: 'ip',
          retryAfterMs: ipResult.resetMs,
          headers: this._buildHeaders(ipResult, 'ip')
        };
      }
    }

    // 3. 端点级别限流检查
    const matchedEndpoint = this._matchEndpoint(pathname);
    if (matchedEndpoint) {
      const endpointKey = `${ip}:${matchedEndpoint}`;
      const endpointResult = this.endpointCounters[matchedEndpoint].hit(endpointKey);
      if (!endpointResult.allowed) {
        this.stats.blockedRequests++;
        return {
          allowed: false,
          reason: 'endpoint',
          endpoint: matchedEndpoint,
          retryAfterMs: endpointResult.resetMs,
          headers: this._buildHeaders(endpointResult, 'endpoint')
        };
      }

      // 端点限流的 headers 优先返回（最严格的）
      return {
        allowed: true,
        headers: this._buildHeaders(endpointResult, 'endpoint')
      };
    }

    // 如果没有匹配到端点规则，返回 IP 级别的 headers
    const ipPeek = this.ipCounter.peek(ip);
    return {
      allowed: true,
      headers: this._buildHeaders({
        remaining: ipPeek.remaining,
        total: ipPeek.total,
        resetMs: this.config.perIP.windowMs
      }, 'ip')
    };
  }

  /**
   * 构建标准限流 HTTP 响应头
   * 遵循 IETF RateLimit Header Fields 草案
   */
  _buildHeaders(result, source) {
    if (!result || source === 'whitelist') {
      return {
        'X-RateLimit-Source': 'whitelist'
      };
    }

    const headers = {
      'X-RateLimit-Limit': String(result.total),
      'X-RateLimit-Remaining': String(Math.max(result.remaining, 0)),
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + (result.resetMs || 0)) / 1000)),
      'X-RateLimit-Source': source
    };

    if (!result.allowed) {
      headers['Retry-After'] = String(Math.ceil((result.resetMs || 0) / 1000));
    }

    return headers;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      trackedIPs: this.ipCounter.size,
      trackedEndpoints: Object.entries(this.endpointCounters).reduce((acc, [path, counter]) => {
        acc[path] = counter.size;
        return acc;
      }, {}),
      config: {
        global: `${this.config.global.maxHits} req / ${this.config.global.windowMs / 1000}s`,
        perIP: `${this.config.perIP.maxHits} req / ${this.config.perIP.windowMs / 1000}s`,
        endpoints: Object.entries(this.config.endpoints).reduce((acc, [path, rule]) => {
          acc[path] = `${rule.maxHits} req / ${rule.windowMs / 1000}s`;
          return acc;
        }, {})
      }
    };
  }

  /**
   * 停止自动清理定时器
   */
  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

// ==================== 导出 ====================
module.exports = { RateLimiter, SlidingWindowCounter };
