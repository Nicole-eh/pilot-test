#!/usr/bin/env node

const { AppError } = require('./errors');
const { logger } = require('./logger');

/**
 * 统一错误处理模块
 *
 * 职责：
 * 1. 集中捕获并处理所有路由中抛出的错误
 * 2. 区分「可预期的业务错误」和「意外的系统错误」
 * 3. 标准化所有错误响应格式
 * 4. 非生产环境返回 stack trace，生产环境隐藏内部信息
 * 5. 自动记录错误日志（业务错误 warn，系统错误 error）
 *
 * 标准错误响应格式：
 * {
 *   success: false,
 *   error: {
 *     code: 'VALIDATION_ERROR',
 *     message: '缺少必填字段：name 和 email',
 *     details: { ... },     // 可选，仅业务错误提供
 *     stack: '...'           // 仅非生产环境
 *   }
 * }
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ==================== 响应格式化 ====================

/**
 * 构建标准化错误响应体
 */
function formatErrorResponse(error, requestId) {
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    }
  };

  // 附加请求 ID 便于追踪
  if (requestId) {
    response.error.requestId = requestId;
  }

  // 附加错误详情（仅业务错误的自定义 details）
  if (error.details) {
    response.error.details = error.details;
  }

  // 非生产环境附加堆栈信息，方便调试
  if (!IS_PRODUCTION && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

/**
 * 发送错误 JSON 响应
 */
function sendErrorResponse(res, statusCode, body) {
  // 防止重复发送（响应已经开始写入）
  if (res.headersSent) {
    return;
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body, null, 2));
}

// ==================== 核心错误处理器 ====================

/**
 * 统一错误处理函数
 *
 * 在 http.createServer 的 try/catch 中调用：
 *   try { await handleRequest(req, res); } catch (error) { handleError(error, req, res); }
 *
 * @param {Error} error - 捕获到的错误
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
function handleError(error, req, res) {
  const requestId = req.requestId || null;

  // 1. 可预期的业务错误（AppError 及其子类）
  if (error instanceof AppError) {
    // 业务错误用 warn 级别记录（4xx 不是服务器故障）
    logger.warn(`${error.name}: ${error.message}`, {
      requestId,
      code: error.code,
      statusCode: error.statusCode,
      method: req.method,
      url: req.url
    });

    const body = formatErrorResponse(error, requestId);
    sendErrorResponse(res, error.statusCode, body);
    return;
  }

  // 2. 意外的系统错误（未预见的 bug、第三方库异常等）
  logger.error(`未预期的错误: ${error.message}`, {
    requestId,
    method: req.method,
    url: req.url,
    stack: error.stack
  });

  // 生产环境不暴露内部错误信息
  const safeError = {
    code: 'INTERNAL_ERROR',
    message: IS_PRODUCTION ? '服务器内部错误，请稍后重试' : error.message,
    stack: error.stack
  };

  const body = formatErrorResponse(safeError, requestId);
  sendErrorResponse(res, 500, body);
}

// ==================== 包装路由处理器 ====================

/**
 * 异步路由包装器
 *
 * 将 async handler 包装成自动 try/catch 的版本，
 * 避免每个 handler 都要手写 try/catch。
 *
 * 用法：
 *   const safeHandler = asyncHandler(async (req, res) => { ... });
 *
 * @param {Function} fn - async handler 函数
 * @returns {Function} 包装后的 handler
 */
function asyncHandler(fn) {
  return async (req, res, ...args) => {
    try {
      await fn(req, res, ...args);
    } catch (error) {
      handleError(error, req, res);
    }
  };
}

// ==================== 进程级错误兜底 ====================

/**
 * 注册全局未捕获错误处理
 * 这是最后一道防线，正常情况下不应该走到这里
 */
function registerGlobalHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常 (uncaughtException)', {
      error: error.message,
      stack: error.stack
    });
    // 对于非业务错误的未捕获异常，安全退出
    if (!error.isOperational) {
      logger.error('非业务错误的未捕获异常，进程即将退出');
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('未处理的 Promise rejection (unhandledRejection)', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });
}

// ==================== 导出 ====================
module.exports = {
  handleError,
  asyncHandler,
  formatErrorResponse,
  registerGlobalHandlers
};
