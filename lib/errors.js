#!/usr/bin/env node

/**
 * 自定义错误类层级
 *
 * 所有业务错误继承自 AppError，包含 HTTP 状态码和错误代码。
 * 这样在统一错误处理中间件里可以：
 * 1. 通过 instanceof 判断错误类型
 * 2. 自动映射到正确的 HTTP 状态码
 * 3. 区分「可预期的业务错误」和「意外的系统错误」
 *
 * 错误类：
 *   AppError            (base)  - 通用应用错误
 *   ValidationError     (400)   - 请求参数验证失败
 *   AuthenticationError (401)   - 未认证 / Token 无效
 *   AuthorizationError  (403)   - 权限不足
 *   NotFoundError       (404)   - 资源不存在
 *   ConflictError       (409)   - 资源冲突（如重复注册）
 */

// ==================== 基础错误类 ====================

class AppError extends Error {
  /**
   * @param {string} message - 用户可见的错误信息
   * @param {number} statusCode - HTTP 状态码
   * @param {string} code - 机器可读的错误代码（如 'VALIDATION_ERROR'）
   * @param {object} [details] - 附加错误详情（如具体哪个字段出错）
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // 标记为「可预期的业务错误」，不需要打印完整堆栈
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ==================== 具体错误类 ====================

/**
 * 400 - 请求参数验证错误
 * 场景：缺少必填字段、格式不对、JSON 解析失败等
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * 401 - 认证错误
 * 场景：未提供 Token、Token 过期、Token 无效
 */
class AuthenticationError extends AppError {
  constructor(message = '认证失败，请登录') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * 403 - 授权错误
 * 场景：已认证但权限不足
 */
class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * 404 - 资源未找到
 * 场景：请求的实体不存在
 */
class NotFoundError extends AppError {
  constructor(resource = '资源', id = null) {
    const message = id
      ? `未找到 ID 为 ${id} 的${resource}`
      : `${resource}不存在`;
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 409 - 资源冲突
 * 场景：邮箱已被使用、用户名已被注册
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

// ==================== 导出 ====================
module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
};
