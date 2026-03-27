#!/usr/bin/env node

/**
 * 声明式请求参数校验模块（零依赖）
 *
 * 设计思想：
 *   1. 用 Schema 对象声明字段规则，而不是在每个 handler 里手写 if/else
 *   2. 一次性收集所有校验错误，返回给调用方
 *   3. 支持常见规则：required / type / minLength / maxLength / min / max / pattern / enum / custom
 *
 * 用法示例：
 *   const { validate } = require('./validator');
 *
 *   const schema = {
 *     name:  { type: 'string', required: true, minLength: 1, label: '用户名' },
 *     email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: '邮箱' },
 *     age:   { type: 'number', min: 0, max: 150, label: '年龄' },
 *   };
 *
 *   const { valid, errors, cleaned } = validate(data, schema);
 *   // valid   - boolean
 *   // errors  - [{ field: 'email', message: '邮箱 格式不正确' }, ...]
 *   // cleaned - 只包含 schema 中声明的字段，并做了 trim 等清洗
 */

// ==================== 内置规则检查器 ====================

/**
 * 检查 required（必填）
 * 空字符串、null、undefined 均视为缺失
 */
function checkRequired(value, rule, field, label) {
  if (!rule.required) return null;
  if (value === undefined || value === null || value === '') {
    return { field, message: `${label} 为必填项` };
  }
  return null;
}

/**
 * 检查 type（类型）
 * 支持 'string' | 'number' | 'boolean' | 'array' | 'object'
 */
function checkType(value, rule, field, label) {
  if (!rule.type || value === undefined || value === null) return null;

  const typeCheckers = {
    string:  v => typeof v === 'string',
    number:  v => typeof v === 'number' && !isNaN(v),
    boolean: v => typeof v === 'boolean',
    array:   v => Array.isArray(v),
    object:  v => typeof v === 'object' && !Array.isArray(v) && v !== null,
  };

  const checker = typeCheckers[rule.type];
  if (!checker) return null; // 未知类型跳过

  if (!checker(value)) {
    return { field, message: `${label} 类型应为 ${rule.type}` };
  }
  return null;
}

/**
 * 检查 minLength / maxLength（字符串长度）
 */
function checkLength(value, rule, field, label) {
  if (typeof value !== 'string') return null;

  if (rule.minLength !== undefined && value.length < rule.minLength) {
    return { field, message: `${label} 长度不能少于 ${rule.minLength} 个字符` };
  }
  if (rule.maxLength !== undefined && value.length > rule.maxLength) {
    return { field, message: `${label} 长度不能超过 ${rule.maxLength} 个字符` };
  }
  return null;
}

/**
 * 检查 min / max（数值范围）
 */
function checkRange(value, rule, field, label) {
  if (typeof value !== 'number') return null;

  if (rule.min !== undefined && value < rule.min) {
    return { field, message: `${label} 不能小于 ${rule.min}` };
  }
  if (rule.max !== undefined && value > rule.max) {
    return { field, message: `${label} 不能大于 ${rule.max}` };
  }
  return null;
}

/**
 * 检查 pattern（正则匹配）
 */
function checkPattern(value, rule, field, label) {
  if (!rule.pattern || typeof value !== 'string') return null;

  if (!rule.pattern.test(value)) {
    return { field, message: rule.patternMessage || `${label} 格式不正确` };
  }
  return null;
}

/**
 * 检查 enum（枚举值）
 */
function checkEnum(value, rule, field, label) {
  if (!rule.enum || value === undefined || value === null) return null;

  if (!rule.enum.includes(value)) {
    return { field, message: `${label} 的值必须是以下之一: ${rule.enum.join(', ')}` };
  }
  return null;
}

/**
 * 检查 custom（自定义校验函数）
 * custom: (value, data) => null | '错误信息'
 */
function checkCustom(value, rule, field, label, data) {
  if (!rule.custom || typeof rule.custom !== 'function') return null;

  const errorMessage = rule.custom(value, data);
  if (errorMessage) {
    return { field, message: errorMessage };
  }
  return null;
}

// 所有内置检查器，按执行顺序排列
const CHECKERS = [
  checkRequired,
  checkType,
  checkLength,
  checkRange,
  checkPattern,
  checkEnum,
  // checkCustom 单独处理，因为它需要额外的 data 参数
];

// ==================== 核心校验函数 ====================

/**
 * 校验数据对象
 *
 * @param {object} data   - 待校验的数据（通常是 request body）
 * @param {object} schema - 校验规则定义
 *   每个字段的规则对象支持：
 *   {
 *     required:       boolean,          // 是否必填
 *     type:           string,           // 'string' | 'number' | 'boolean' | 'array' | 'object'
 *     minLength:      number,           // 最小长度（字符串）
 *     maxLength:      number,           // 最大长度（字符串）
 *     min:            number,           // 最小值（数字）
 *     max:            number,           // 最大值（数字）
 *     pattern:        RegExp,           // 正则校验
 *     patternMessage: string,           // 正则校验失败时的自定义消息
 *     enum:           Array,            // 枚举值
 *     trim:           boolean,          // 是否 trim（默认 true）
 *     default:        any,              // 默认值
 *     label:          string,           // 字段显示名（用于错误消息）
 *     custom:         Function,         // 自定义校验 (value, data) => null | '错误信息'
 *   }
 *
 * @returns {{ valid: boolean, errors: Array<{field, message}>, cleaned: object }}
 */
function validate(data, schema) {
  const errors = [];
  const cleaned = {};

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ field: '_body', message: '请求体必须是有效的 JSON 对象' }],
      cleaned: {}
    };
  }

  for (const [field, rule] of Object.entries(schema)) {
    const label = rule.label || field;
    let value = data[field];

    // 字符串自动 trim（默认开启）
    if (typeof value === 'string' && rule.trim !== false) {
      value = value.trim();
    }

    // 应用默认值
    if ((value === undefined || value === null || value === '') && rule.default !== undefined) {
      value = rule.default;
    }

    // 执行内置检查器
    for (const checker of CHECKERS) {
      const error = checker(value, rule, field, label);
      if (error) {
        errors.push(error);
        break; // 同一字段遇到第一个错误就停（避免冗余消息）
      }
    }

    // 执行自定义检查（只在内置检查全部通过时才执行）
    if (!errors.find(e => e.field === field)) {
      const customError = checkCustom(value, rule, field, label, data);
      if (customError) {
        errors.push(customError);
      }
    }

    // 收集清洗后的值（只保留 schema 中声明的字段）
    if (value !== undefined && value !== null) {
      cleaned[field] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned
  };
}

// ==================== 预定义 Schema ====================
// 集中管理所有 API 的校验规则，方便查看和维护

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schemas = {
  // POST /api/users - 创建用户
  createUser: {
    name: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 50,
      label: '用户名',
    },
    email: {
      type: 'string',
      required: true,
      pattern: EMAIL_REGEX,
      patternMessage: '邮箱 格式不正确（示例: user@example.com）',
      label: '邮箱',
    },
    age: {
      type: 'number',
      min: 0,
      max: 150,
      default: 0,
      label: '年龄',
    },
  },

  // PUT /api/users/:id - 更新用户
  updateUser: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
      label: '用户名',
    },
    email: {
      type: 'string',
      pattern: EMAIL_REGEX,
      patternMessage: '邮箱 格式不正确（示例: user@example.com）',
      label: '邮箱',
    },
    age: {
      type: 'number',
      min: 0,
      max: 150,
      label: '年龄',
    },
  },

  // POST /api/todos - 创建待办
  createTodo: {
    text: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 200,
      label: '待办内容',
    },
  },

  // PUT /api/todos/:id - 更新待办
  updateTodo: {
    text: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
      label: '待办内容',
    },
    done: {
      type: 'boolean',
      label: '完成状态',
    },
  },

  // POST /api/auth/register - 注册
  register: {
    username: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      patternMessage: '用户名 只能包含字母、数字、下划线或中文',
      label: '用户名',
    },
    password: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 100,
      label: '密码',
    },
    role: {
      type: 'string',
      enum: ['admin', 'user'],
      default: 'user',
      label: '角色',
    },
  },

  // POST /api/auth/login - 登录
  login: {
    username: {
      type: 'string',
      required: true,
      label: '用户名',
    },
    password: {
      type: 'string',
      required: true,
      label: '密码',
    },
  },

  // POST /api/auth/refresh - 刷新 Token
  refreshToken: {
    refreshToken: {
      type: 'string',
      required: true,
      label: 'Refresh Token',
    },
  },
};

// ==================== 导出 ====================

module.exports = {
  validate,
  schemas,
  EMAIL_REGEX,
};
