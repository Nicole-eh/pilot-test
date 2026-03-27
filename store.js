#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { logger } = require('./lib/logger');

/**
 * 通用 JSON 文件存储模块
 * 提供统一的文件读写、ID 生成和 CRUD 操作
 */
class JsonStore {
  /**
   * @param {string} filePath - JSON 文件的绝对路径
   * @param {Array} defaultData - 文件不存在时的默认数据
   */
  constructor(filePath, defaultData = []) {
    this.filePath = filePath;
    this._ensureDirectory();
    this._data = this._load(defaultData);
  }

  /** 确保文件所在目录存在 */
  _ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /** 从文件加载数据 */
  _load(defaultData) {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      } catch (error) {
        logger.error('读取数据文件失败，使用默认数据', { file: this.filePath, error: error.message });
        return [...defaultData];
      }
    }
    // 文件不存在，使用默认数据并写入
    const data = [...defaultData];
    this._save(data);
    return data;
  }

  /** 安全写入：先写临时文件再重命名，防止写入中途崩溃导致数据损坏 */
  _save(data) {
    const tmpFile = this.filePath + '.tmp';
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.filePath);
    } catch (error) {
      logger.error('保存数据文件失败', { file: this.filePath, error: error.message });
      // 清理临时文件
      try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
      throw error;
    }
  }

  /** 生成下一个可用 ID（安全处理空数组） */
  _nextId() {
    if (this._data.length === 0) return 1;
    return Math.max(...this._data.map(item => item.id)) + 1;
  }

  /** 获取所有记录 */
  getAll() {
    return [...this._data];
  }

  /** 根据 ID 获取单条记录 */
  getById(id) {
    return this._data.find(item => item.id === parseInt(id)) || null;
  }

  /** 创建新记录，自动添加 id 和 createdAt */
  create(record) {
    const newRecord = {
      id: this._nextId(),
      ...record,
      createdAt: new Date().toISOString()
    };
    this._data.push(newRecord);
    this._save(this._data);
    return newRecord;
  }

  /** 更新记录 */
  update(id, updates) {
    const index = this._data.findIndex(item => item.id === parseInt(id));
    if (index === -1) return null;

    this._data[index] = {
      ...this._data[index],
      ...updates,
      id: this._data[index].id, // 不允许修改 id
      updatedAt: new Date().toISOString()
    };
    this._save(this._data);
    return this._data[index];
  }

  /** 删除记录 */
  delete(id) {
    const index = this._data.findIndex(item => item.id === parseInt(id));
    if (index === -1) return null;

    const deleted = this._data.splice(index, 1)[0];
    this._save(this._data);
    return deleted;
  }

  /** 记录数量 */
  get count() {
    return this._data.length;
  }
}

module.exports = JsonStore;
