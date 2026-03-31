const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// 在 require index.js 前先处理好依赖
// index.js 中 todoStore 指向 data/todos.json，我们在测试时不干扰它
// 只测试纯函数：greet、calculator

const { greet, calculator } = require('../index');

// ==================== greet 函数测试 ====================
describe('greet()', () => {
  it('无参数时应返回默认问候', () => {
    const result = greet();
    assert.strictEqual(result, '你好, World! 👋');
  });

  it('应正确问候指定名字', () => {
    const result = greet('小明');
    assert.strictEqual(result, '你好, 小明! 👋');
  });

  it('应正确处理英文名', () => {
    const result = greet('Alice');
    assert.strictEqual(result, '你好, Alice! 👋');
  });

  it('应正确处理空字符串（回退到默认值）', () => {
    // 空字符串是 falsy 但不是 undefined，不会触发默认参数
    const result = greet('');
    assert.strictEqual(result, '你好, ! 👋');
  });

  it('应正确处理含空格的名字', () => {
    const result = greet('张 三丰');
    assert.strictEqual(result, '你好, 张 三丰! 👋');
  });

  it('应正确处理特殊字符', () => {
    const result = greet('O\'Brien');
    assert.strictEqual(result, '你好, O\'Brien! 👋');
  });
});

// ==================== calculator 函数测试 ====================
describe('calculator()', () => {

  // ---------- 加法 ----------
  describe('加法 (add)', () => {
    it('正数加法', () => {
      assert.strictEqual(calculator('add', '5', '3'), '5 + 3 = 8');
    });

    it('负数加法', () => {
      assert.strictEqual(calculator('add', '-5', '3'), '-5 + 3 = -2');
    });

    it('小数加法', () => {
      assert.strictEqual(calculator('add', '1.5', '2.3'), '1.5 + 2.3 = 3.8');
    });

    it('零加法', () => {
      assert.strictEqual(calculator('add', '0', '0'), '0 + 0 = 0');
    });

    it('中文指令 "加"', () => {
      assert.strictEqual(calculator('加', '10', '20'), '10 + 20 = 30');
    });
  });

  // ---------- 减法 ----------
  describe('减法 (subtract)', () => {
    it('正数减法', () => {
      assert.strictEqual(calculator('subtract', '10', '4'), '10 - 4 = 6');
    });

    it('结果为负数', () => {
      assert.strictEqual(calculator('subtract', '3', '8'), '3 - 8 = -5');
    });

    it('中文指令 "减"', () => {
      assert.strictEqual(calculator('减', '100', '50'), '100 - 50 = 50');
    });
  });

  // ---------- 乘法 ----------
  describe('乘法 (multiply)', () => {
    it('正数乘法', () => {
      assert.strictEqual(calculator('multiply', '6', '7'), '6 × 7 = 42');
    });

    it('乘以零', () => {
      assert.strictEqual(calculator('multiply', '100', '0'), '100 × 0 = 0');
    });

    it('负数乘法', () => {
      assert.strictEqual(calculator('multiply', '-3', '4'), '-3 × 4 = -12');
    });

    it('中文指令 "乘"', () => {
      assert.strictEqual(calculator('乘', '5', '5'), '5 × 5 = 25');
    });
  });

  // ---------- 除法 ----------
  describe('除法 (divide)', () => {
    it('正常除法', () => {
      assert.strictEqual(calculator('divide', '20', '4'), '20 ÷ 4 = 5');
    });

    it('除法产生小数', () => {
      assert.strictEqual(calculator('divide', '10', '3'), '10 ÷ 3 = 3.3333333333333335');
    });

    it('除以零应报错', () => {
      const result = calculator('divide', '10', '0');
      assert.ok(result.includes('除数不能为 0'), '应提示除数不能为 0');
    });

    it('中文指令 "除"', () => {
      assert.strictEqual(calculator('除', '100', '25'), '100 ÷ 25 = 4');
    });
  });

  // ---------- 错误处理 ----------
  describe('错误处理', () => {
    it('非数字输入应报错', () => {
      const result = calculator('add', 'abc', '5');
      assert.ok(result.includes('请输入有效的数字'));
    });

    it('第二个参数非数字应报错', () => {
      const result = calculator('add', '5', 'xyz');
      assert.ok(result.includes('请输入有效的数字'));
    });

    it('两个参数都非数字应报错', () => {
      const result = calculator('add', 'foo', 'bar');
      assert.ok(result.includes('请输入有效的数字'));
    });

    it('不支持的运算应报错', () => {
      const result = calculator('power', '2', '3');
      assert.ok(result.includes('不支持的运算'));
    });

    it('大小写不敏感', () => {
      assert.strictEqual(calculator('ADD', '1', '2'), '1 + 2 = 3');
      assert.strictEqual(calculator('Multiply', '2', '3'), '2 × 3 = 6');
    });
  });

  // ---------- 边界值 ----------
  describe('边界值', () => {
    it('非常大的数字', () => {
      const result = calculator('add', '999999999', '1');
      assert.strictEqual(result, '999999999 + 1 = 1000000000');
    });

    it('非常小的小数', () => {
      const result = calculator('add', '0.1', '0.2');
      // 浮点精度问题：0.1 + 0.2 = 0.30000000000000004
      assert.ok(result.startsWith('0.1 + 0.2 = 0.3'));
    });

    it('负数与负数', () => {
      assert.strictEqual(calculator('add', '-5', '-3'), '-5 + -3 = -8');
    });
  });
});
