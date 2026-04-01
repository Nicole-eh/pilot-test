const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const JsonStore = require('../store');

// 使用临时目录，避免污染真实数据
const TEST_DIR = path.join(__dirname, '.tmp-test-data');

function getTempFile(name) {
  return path.join(TEST_DIR, name);
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// ==================== JsonStore 单元测试 ====================
describe('JsonStore', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ---------- 初始化 ----------
  describe('constructor / 初始化', () => {
    it('应自动创建目录和文件', () => {
      const filePath = getTempFile('init.json');
      const store = new JsonStore(filePath);

      assert.ok(fs.existsSync(filePath), '文件应被创建');
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.deepStrictEqual(content, []);
    });

    it('应使用提供的默认数据初始化', () => {
      const filePath = getTempFile('defaults.json');
      const defaults = [{ id: 1, name: 'test' }];
      const store = new JsonStore(filePath, defaults);

      assert.strictEqual(store.count, 1);
      assert.strictEqual(store.getAll()[0].name, 'test');
    });

    it('应从已有文件加载数据', () => {
      const filePath = getTempFile('existing.json');
      // 先手动写入数据
      fs.mkdirSync(TEST_DIR, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]), 'utf8');

      const store = new JsonStore(filePath);
      assert.strictEqual(store.count, 2);
      assert.strictEqual(store.getAll()[0].name, 'Alice');
    });

    it('文件内容损坏时应回退到默认数据', () => {
      const filePath = getTempFile('corrupted.json');
      fs.mkdirSync(TEST_DIR, { recursive: true });
      fs.writeFileSync(filePath, '这不是有效的 JSON!!!', 'utf8');

      const store = new JsonStore(filePath, []);
      assert.strictEqual(store.count, 0);
    });
  });

  // ---------- CREATE ----------
  describe('create()', () => {
    it('应创建记录并自动分配 id', () => {
      const store = new JsonStore(getTempFile('create.json'));
      const record = store.create({ name: 'Test' });

      assert.strictEqual(record.id, 1);
      assert.strictEqual(record.name, 'Test');
      assert.ok(record.createdAt, '应包含 createdAt 时间戳');
    });

    it('连续创建应分配递增 id', () => {
      const store = new JsonStore(getTempFile('create-seq.json'));
      const r1 = store.create({ name: 'A' });
      const r2 = store.create({ name: 'B' });
      const r3 = store.create({ name: 'C' });

      assert.strictEqual(r1.id, 1);
      assert.strictEqual(r2.id, 2);
      assert.strictEqual(r3.id, 3);
      assert.strictEqual(store.count, 3);
    });

    it('创建的记录应持久化到文件', () => {
      const filePath = getTempFile('create-persist.json');
      const store = new JsonStore(filePath);
      store.create({ name: 'Persist' });

      // 重新读取文件验证
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.strictEqual(fileData.length, 1);
      assert.strictEqual(fileData[0].name, 'Persist');
    });

    it('createdAt 应为有效的 ISO 日期', () => {
      const store = new JsonStore(getTempFile('create-date.json'));
      const record = store.create({ name: 'Date' });

      const date = new Date(record.createdAt);
      assert.ok(!isNaN(date.getTime()), 'createdAt 应为有效日期');
    });
  });

  // ---------- READ ----------
  describe('getAll()', () => {
    it('空 store 应返回空数组', () => {
      const store = new JsonStore(getTempFile('getall-empty.json'));
      const all = store.getAll();

      assert.ok(Array.isArray(all));
      assert.strictEqual(all.length, 0);
    });

    it('应返回所有记录的副本（不影响内部数据）', () => {
      const store = new JsonStore(getTempFile('getall-copy.json'));
      store.create({ name: 'A' });
      store.create({ name: 'B' });

      const all = store.getAll();
      assert.strictEqual(all.length, 2);

      // 修改返回值不应影响 store
      all.push({ id: 99, name: 'Hacker' });
      assert.strictEqual(store.count, 2);
    });
  });

  describe('getById()', () => {
    it('应根据 id 找到对应记录', () => {
      const store = new JsonStore(getTempFile('getbyid.json'));
      store.create({ name: 'Target' });
      store.create({ name: 'Other' });

      const found = store.getById(1);
      assert.strictEqual(found.name, 'Target');
    });

    it('id 不存在时应返回 null', () => {
      const store = new JsonStore(getTempFile('getbyid-null.json'));
      store.create({ name: 'Only' });

      const found = store.getById(999);
      assert.strictEqual(found, null);
    });

    it('应支持字符串形式的 id', () => {
      const store = new JsonStore(getTempFile('getbyid-str.json'));
      store.create({ name: 'StringId' });

      const found = store.getById('1');
      assert.strictEqual(found.name, 'StringId');
    });
  });

  // ---------- UPDATE ----------
  describe('update()', () => {
    it('应更新指定记录的字段', () => {
      const store = new JsonStore(getTempFile('update.json'));
      store.create({ name: 'Old', score: 10 });

      const updated = store.update(1, { name: 'New', score: 99 });
      assert.strictEqual(updated.name, 'New');
      assert.strictEqual(updated.score, 99);
    });

    it('更新不应改变 id', () => {
      const store = new JsonStore(getTempFile('update-id.json'));
      store.create({ name: 'Keep' });

      const updated = store.update(1, { id: 999, name: 'Changed' });
      assert.strictEqual(updated.id, 1, 'id 不应被覆盖');
      assert.strictEqual(updated.name, 'Changed');
    });

    it('更新应添加 updatedAt 时间戳', () => {
      const store = new JsonStore(getTempFile('update-ts.json'));
      store.create({ name: 'Before' });

      const updated = store.update(1, { name: 'After' });
      assert.ok(updated.updatedAt, '应包含 updatedAt');
      assert.ok(!isNaN(new Date(updated.updatedAt).getTime()));
    });

    it('应保留未更新的字段', () => {
      const store = new JsonStore(getTempFile('update-partial.json'));
      store.create({ name: 'Full', email: 'a@b.com', age: 25 });

      const updated = store.update(1, { age: 30 });
      assert.strictEqual(updated.name, 'Full');
      assert.strictEqual(updated.email, 'a@b.com');
      assert.strictEqual(updated.age, 30);
    });

    it('id 不存在时应返回 null', () => {
      const store = new JsonStore(getTempFile('update-null.json'));
      const result = store.update(999, { name: 'Ghost' });
      assert.strictEqual(result, null);
    });

    it('更新应持久化到文件', () => {
      const filePath = getTempFile('update-persist.json');
      const store = new JsonStore(filePath);
      store.create({ name: 'V1' });
      store.update(1, { name: 'V2' });

      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.strictEqual(fileData[0].name, 'V2');
    });
  });

  // ---------- DELETE ----------
  describe('delete()', () => {
    it('应删除指定记录并返回被删除的记录', () => {
      const store = new JsonStore(getTempFile('delete.json'));
      store.create({ name: 'Victim' });
      store.create({ name: 'Survivor' });

      const deleted = store.delete(1);
      assert.strictEqual(deleted.name, 'Victim');
      assert.strictEqual(store.count, 1);
      assert.strictEqual(store.getAll()[0].name, 'Survivor');
    });

    it('id 不存在时应返回 null', () => {
      const store = new JsonStore(getTempFile('delete-null.json'));
      const result = store.delete(999);
      assert.strictEqual(result, null);
    });

    it('删除应持久化到文件', () => {
      const filePath = getTempFile('delete-persist.json');
      const store = new JsonStore(filePath);
      store.create({ name: 'Gone' });
      store.delete(1);

      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.strictEqual(fileData.length, 0);
    });

    it('应支持字符串形式的 id', () => {
      const store = new JsonStore(getTempFile('delete-str.json'));
      store.create({ name: 'StrDelete' });

      const deleted = store.delete('1');
      assert.strictEqual(deleted.name, 'StrDelete');
    });
  });

  // ---------- count ----------
  describe('count', () => {
    it('空 store 应为 0', () => {
      const store = new JsonStore(getTempFile('count-0.json'));
      assert.strictEqual(store.count, 0);
    });

    it('应反映实际记录数量', () => {
      const store = new JsonStore(getTempFile('count-n.json'));
      store.create({ name: 'A' });
      store.create({ name: 'B' });
      assert.strictEqual(store.count, 2);

      store.delete(1);
      assert.strictEqual(store.count, 1);
    });
  });

  // ---------- _nextId 边界 ----------
  describe('ID 生成（边界情况）', () => {
    it('删除中间记录后，新记录 id 应基于最大值递增', () => {
      const store = new JsonStore(getTempFile('id-gap.json'));
      store.create({ name: 'A' }); // id=1
      store.create({ name: 'B' }); // id=2
      store.create({ name: 'C' }); // id=3
      store.delete(2);             // 删除 id=2

      const d = store.create({ name: 'D' });
      assert.strictEqual(d.id, 4, '新 id 应为 4，而不是 2');
    });

    it('删除所有记录后，新记录 id 应从 1 开始', () => {
      const store = new JsonStore(getTempFile('id-reset.json'));
      store.create({ name: 'A' });
      store.delete(1);

      const b = store.create({ name: 'B' });
      assert.strictEqual(b.id, 1);
    });
  });
});
