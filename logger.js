#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 请求日志中间件
 *
 * 功能：
 * 1. 记录每个 HTTP 请求的方法、路径、状态码、响应时间
 * 2. 控制台彩色输出（按 HTTP 方法和状态码着色）
 * 3. 可选：写入日志文件（追加模式）
 * 4. 可配置的日志级别和输出目标
 *
 * 用法：
 *   const logger = require('./logger');
 *   // 在请求处理开始时调用 logger.start(req)
 *   // 在响应发送完毕后调用 logger.end(req, res)
 */

// ==================== 配置 ====================
const DEFAULT_CONFIG = {
  // 是否启用控制台输出
  console: true,
  // 是否启用文件日志
  file: true,
  // 日志文件路径
  filePath: path.join(__dirname, 'logs', 'access.log'),
  // 日志级别: 'all' | 'error' (error 仅记录 4xx/5xx)
  level: 'all',
  // 日期时区
  timezone: 'Asia/Shanghai'
};

// ==================== ANSI 颜色代码 ====================
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // 前景色
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // 背景色
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

// ==================== 工具函数 ====================

/**
 * 获取格式化的时间戳
 */
function getTimestamp(timezone) {
  return new Date().toLocaleString('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 根据 HTTP 方法返回对应的颜色
 */
function getMethodColor(method) {
  const map = {
    GET: COLORS.green,
    POST: COLORS.cyan,
    PUT: COLORS.yellow,
    PATCH: COLORS.yellow,
    DELETE: COLORS.red,
    OPTIONS: COLORS.gray,
    HEAD: COLORS.gray
  };
  return map[method] || COLORS.white;
}

/**
 * 根据状态码返回对应的颜色
 */
function getStatusColor(statusCode) {
  if (statusCode >= 500) return COLORS.red;
  if (statusCode >= 400) return COLORS.yellow;
  if (statusCode >= 300) return COLORS.cyan;
  if (statusCode >= 200) return COLORS.green;
  return COLORS.white;
}

/**
 * 将 HTTP 方法左对齐到固定宽度
 */
function padMethod(method) {
  return method.padEnd(7);
}

/**
 * 格式化响应时间，带单位
 */
function formatDuration(ms) {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * 确保日志目录存在
 */
function ensureLogDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ==================== 日志记录器类 ====================

class RequestLogger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 如果启用文件日志，确保目录存在
    if (this.config.file) {
      ensureLogDirectory(this.config.filePath);
    }
  }

  /**
   * 标记请求开始时间
   * 在请求处理的最开始调用
   * @param {http.IncomingMessage} req
   */
  start(req) {
    req._startTime = process.hrtime.bigint();
  }

  /**
   * 记录请求日志
   * 在响应发送完毕后调用
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  end(req, res) {
    // 计算响应时间
    const durationNs = req._startTime
      ? Number(process.hrtime.bigint() - req._startTime)
      : 0;
    const durationMs = durationNs / 1e6;

    const method = req.method;
    const url = req.url;
    const statusCode = res.statusCode;
    const timestamp = getTimestamp(this.config.timezone);

    // 根据日志级别过滤
    if (this.config.level === 'error' && statusCode < 400) {
      return;
    }

    // 控制台输出（彩色）
    if (this.config.console) {
      this._logToConsole(timestamp, method, url, statusCode, durationMs);
    }

    // 文件输出（纯文本）
    if (this.config.file) {
      this._logToFile(timestamp, method, url, statusCode, durationMs);
    }
  }

  /**
   * 彩色控制台输出
   */
  _logToConsole(timestamp, method, url, statusCode, durationMs) {
    const mc = getMethodColor(method);
    const sc = getStatusColor(statusCode);
    const dc = durationMs > 500 ? COLORS.red : durationMs > 100 ? COLORS.yellow : COLORS.gray;
    const R = COLORS.reset;

    const line = [
      `${COLORS.dim}[${timestamp}]${R}`,
      `${mc}${COLORS.bright}${padMethod(method)}${R}`,
      `${url}`,
      `${sc}${COLORS.bright}${statusCode}${R}`,
      `${dc}${formatDuration(durationMs)}${R}`
    ].join('  ');

    console.log(line);
  }

  /**
   * 追加写入日志文件（纯文本，一行一条）
   */
  _logToFile(timestamp, method, url, statusCode, durationMs) {
    const line = `[${timestamp}] ${method} ${url} ${statusCode} ${formatDuration(durationMs)}\n`;
    try {
      fs.appendFileSync(this.config.filePath, line, 'utf8');
    } catch (error) {
      // 写日志失败不应影响正常请求，只输出到 stderr
      console.error('写入访问日志失败:', error.message);
    }
  }

  /**
   * 记录错误日志
   * @param {Error} error - 错误对象
   * @param {http.IncomingMessage} req - 请求对象
   */
  error(error, req) {
    const timestamp = getTimestamp(this.config.timezone);
    const method = req ? req.method : '-';
    const url = req ? req.url : '-';
    const R = COLORS.reset;

    if (this.config.console) {
      console.error(
        `${COLORS.dim}[${timestamp}]${R}  ` +
        `${COLORS.bgRed}${COLORS.white} ERROR ${R}  ` +
        `${method} ${url}  ` +
        `${COLORS.red}${error.message}${R}`
      );
    }

    if (this.config.file) {
      const line = `[${timestamp}] ERROR ${method} ${url} - ${error.message}\n`;
      try {
        fs.appendFileSync(this.config.filePath, line, 'utf8');
      } catch (err) {
        console.error('写入错误日志失败:', err.message);
      }
    }
  }
}

// ==================== 导出单例 ====================
// 默认配置创建单例；也导出类供自定义配置使用
const logger = new RequestLogger();

module.exports = logger;
module.exports.RequestLogger = RequestLogger;
