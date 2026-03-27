#!/usr/bin/env node

const path = require('path');
const winston = require('winston');
const crypto = require('crypto');

/**
 * Winston 日志模块
 *
 * 功能：
 * 1. 日志分级：error / warn / info / http / debug
 * 2. 控制台彩色输出 + JSON 文件持久化
 * 3. 日志文件自动按大小轮转（maxsize 5MB, 最多保留 5 个）
 * 4. 错误日志独立文件输出
 * 5. HTTP 请求日志（含 request ID、耗时、状态码）
 */

// ==================== 配置 ====================
const LOG_DIR = path.join(__dirname, '..', 'logs');
// 默认 http 级别：记录 error / warn / info / http
// 可通过 LOG_LEVEL=debug 开启更详细的调试日志
const LOG_LEVEL = process.env.LOG_LEVEL || 'http';

// ==================== 日志格式 ====================

/**
 * 控制台输出格式：带颜色、时间戳、可读性强
 * 示例: 2026-03-27 17:30:00 [INFO] 服务器已启动 - port=3000
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: false, level: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ' - ' + Object.entries(meta).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')
      : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

/**
 * 文件输出格式：JSON 结构化，方便日志分析工具解析
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ==================== 创建 Logger 实例 ====================
const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'nodejs-learning-project' },
  transports: [
    // 控制台输出（开发友好）
    new winston.transports.Console({
      format: consoleFormat
    }),

    // 全量日志文件（JSON 格式，按大小轮转）
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    }),

    // 错误日志独立文件
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true
    })
  ],
  // 捕获未处理的异常和 Promise rejection
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log'),
      format: fileFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rejections.log'),
      format: fileFormat
    })
  ],
  exitOnError: false
});

// ==================== HTTP 请求日志 ====================

/**
 * 生成短 request ID（8 位十六进制）
 */
function generateRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * HTTP 请求日志中间件
 * 记录每个请求的 method、path、status、耗时、IP 等信息
 *
 * 用法：在 http.createServer 回调开头调用
 *   const reqLogger = httpLogger(req, res);
 *   // ... 处理请求 ...
 *   // 响应结束时自动记录日志
 */
function httpLogger(req, res) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // 挂载到 req 上，方便后续使用
  req.requestId = requestId;

  // 监听响应完成事件
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';

    logger.log(logLevel, `${req.method} ${req.url} ${statusCode} ${duration}ms`, {
      requestId,
      method: req.method,
      url: req.url,
      statusCode,
      duration: `${duration}ms`,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    originalEnd.apply(res, args);
  };

  return requestId;
}

// ==================== 导出 ====================
module.exports = {
  logger,
  httpLogger,
  generateRequestId
};
