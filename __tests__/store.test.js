const fs = require('fs');
const path = require('path');
const os = require('os');
const JsonStore = require('../store');

describe('JsonStore', () => {
  let tmpDir;
  let filePath;
  let store;

  beforeEach(() => {
    // 每个测试用例使用独立的临时文件
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
    filePath = path.join(tmpDir, 'test-data.json');
  });

  afterEach(() => {
    // 清理临时文件
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    test('should create file with empty array when file does not exist', () => {
      store = new JsonStore(filePath);
      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data).toEqual([]);
    });

    test('should create file with default data when provided', () => {
      const defaults = [{ id: 1, name: 'test' }];
      store = new JsonStore(filePath, defaults);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data).toEqual(defaults);
    });

    test('should load existing data from file', () => {
      const existing = [{ id: 1, name: 'existing' }];
      fs.writeFileSync(filePath, JSON.stringify(existing), 'utf8');
      store = new JsonStore(filePath);
      expect(store.getAll()).toEqual(existing);
    });

    test('should create nested directories if they do not exist', () => {
      const nestedPath = path.join(tmpDir, 'a', 'b', 'c', 'data.json');
      store = new JsonStore(nestedPath);
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    test('should fall back to default data if file contains invalid JSON', () => {
      fs.writeFileSync(filePath, 'not-valid-json', 'utf8');
      const defaults = [{ id: 1, name: 'fallback' }];
      store = new JsonStore(filePath, defaults);
      expect(store.getAll()).toEqual(defaults);
    });
  });

  describe('getAll', () => {
    test('should return a copy of all records', () => {
      store = new JsonStore(filePath);
      store.create({ name: 'a' });
      store.create({ name: 'b' });
      const all = store.getAll();
      expect(all).toHaveLength(2);
      // Ensure it returns a copy, not the internal reference
      all.push({ id: 99, name: 'injected' });
      expect(store.getAll()).toHaveLength(2);
    });
  });

  describe('getById', () => {
    beforeEach(() => {
      store = new JsonStore(filePath);
      store.create({ name: 'Alice' });
      store.create({ name: 'Bob' });
    });

    test('should return the correct record by id', () => {
      const record = store.getById(1);
      expect(record).not.toBeNull();
      expect(record.name).toBe('Alice');
    });

    test('should return the correct record when id is a string', () => {
      const record = store.getById('2');
      expect(record).not.toBeNull();
      expect(record.name).toBe('Bob');
    });

    test('should return null for non-existent id', () => {
      expect(store.getById(999)).toBeNull();
    });
  });

  describe('create', () => {
    beforeEach(() => {
      store = new JsonStore(filePath);
    });

    test('should create a record with auto-incremented id', () => {
      const r1 = store.create({ name: 'first' });
      const r2 = store.create({ name: 'second' });
      expect(r1.id).toBe(1);
      expect(r2.id).toBe(2);
    });

    test('should add createdAt timestamp', () => {
      const record = store.create({ name: 'test' });
      expect(record.createdAt).toBeDefined();
      // Should be a valid ISO date string
      expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
    });

    test('should persist data to file', () => {
      store.create({ name: 'persisted' });
      // Read file directly to verify persistence
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(fileData).toHaveLength(1);
      expect(fileData[0].name).toBe('persisted');
    });

    test('should preserve provided fields', () => {
      const record = store.create({ name: 'test', done: false, extra: 'value' });
      expect(record.name).toBe('test');
      expect(record.done).toBe(false);
      expect(record.extra).toBe('value');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      store = new JsonStore(filePath);
      store.create({ name: 'original', done: false });
    });

    test('should update specified fields', () => {
      const updated = store.update(1, { name: 'updated' });
      expect(updated.name).toBe('updated');
      expect(updated.done).toBe(false); // unchanged field preserved
    });

    test('should not allow changing the id', () => {
      const updated = store.update(1, { id: 999, name: 'hacked' });
      expect(updated.id).toBe(1);
      expect(updated.name).toBe('hacked');
    });

    test('should add updatedAt timestamp', () => {
      const updated = store.update(1, { name: 'updated' });
      expect(updated.updatedAt).toBeDefined();
    });

    test('should return null for non-existent id', () => {
      expect(store.update(999, { name: 'nope' })).toBeNull();
    });

    test('should persist changes to file', () => {
      store.update(1, { name: 'file-updated' });
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(fileData[0].name).toBe('file-updated');
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      store = new JsonStore(filePath);
      store.create({ name: 'to-delete' });
      store.create({ name: 'to-keep' });
    });

    test('should delete a record and return it', () => {
      const deleted = store.delete(1);
      expect(deleted).not.toBeNull();
      expect(deleted.name).toBe('to-delete');
      expect(store.getAll()).toHaveLength(1);
    });

    test('should return null for non-existent id', () => {
      expect(store.delete(999)).toBeNull();
    });

    test('should accept string id', () => {
      const deleted = store.delete('1');
      expect(deleted).not.toBeNull();
    });

    test('should persist deletion to file', () => {
      store.delete(1);
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(fileData).toHaveLength(1);
      expect(fileData[0].name).toBe('to-keep');
    });
  });

  describe('count', () => {
    test('should return 0 for empty store', () => {
      store = new JsonStore(filePath);
      expect(store.count).toBe(0);
    });

    test('should return correct count after operations', () => {
      store = new JsonStore(filePath);
      store.create({ name: 'a' });
      store.create({ name: 'b' });
      expect(store.count).toBe(2);
      store.delete(1);
      expect(store.count).toBe(1);
    });
  });

  describe('_nextId edge cases', () => {
    test('should handle non-sequential ids after deletion', () => {
      store = new JsonStore(filePath);
      store.create({ name: 'a' }); // id: 1
      store.create({ name: 'b' }); // id: 2
      store.create({ name: 'c' }); // id: 3
      store.delete(2);
      // Next id should be max(1, 3) + 1 = 4
      const r4 = store.create({ name: 'd' });
      expect(r4.id).toBe(4);
    });
  });
});
