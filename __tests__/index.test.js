const { greet, calculator } = require('../index');

describe('greet', () => {
  test('should greet with default name when no argument', () => {
    expect(greet()).toBe('你好, World! 👋');
  });

  test('should greet with provided name', () => {
    expect(greet('小明')).toBe('你好, 小明! 👋');
  });

  test('should greet with English name', () => {
    expect(greet('Alice')).toBe('你好, Alice! 👋');
  });

  test('should handle empty string by using it as name', () => {
    expect(greet('')).toBe('你好, ! 👋');
  });
});

describe('calculator', () => {
  describe('addition', () => {
    test('should add two positive numbers', () => {
      expect(calculator('add', '5', '3')).toBe('5 + 3 = 8');
    });

    test('should add with Chinese command', () => {
      expect(calculator('加', '5', '3')).toBe('5 + 3 = 8');
    });

    test('should handle decimal numbers', () => {
      expect(calculator('add', '1.5', '2.3')).toBe('1.5 + 2.3 = 3.8');
    });

    test('should handle negative numbers', () => {
      expect(calculator('add', '-5', '3')).toBe('-5 + 3 = -2');
    });
  });

  describe('subtraction', () => {
    test('should subtract two numbers', () => {
      expect(calculator('subtract', '10', '4')).toBe('10 - 4 = 6');
    });

    test('should subtract with Chinese command', () => {
      expect(calculator('减', '10', '4')).toBe('10 - 4 = 6');
    });
  });

  describe('multiplication', () => {
    test('should multiply two numbers', () => {
      expect(calculator('multiply', '6', '7')).toBe('6 × 7 = 42');
    });

    test('should multiply with Chinese command', () => {
      expect(calculator('乘', '6', '7')).toBe('6 × 7 = 42');
    });

    test('should handle multiplication by zero', () => {
      expect(calculator('multiply', '5', '0')).toBe('5 × 0 = 0');
    });
  });

  describe('division', () => {
    test('should divide two numbers', () => {
      expect(calculator('divide', '20', '4')).toBe('20 ÷ 4 = 5');
    });

    test('should divide with Chinese command', () => {
      expect(calculator('除', '20', '4')).toBe('20 ÷ 4 = 5');
    });

    test('should return error for division by zero', () => {
      const result = calculator('divide', '10', '0');
      expect(result).toContain('除数不能为 0');
    });
  });

  describe('error handling', () => {
    test('should return error for invalid first number', () => {
      const result = calculator('add', 'abc', '3');
      expect(result).toContain('请输入有效的数字');
    });

    test('should return error for invalid second number', () => {
      const result = calculator('add', '3', 'xyz');
      expect(result).toContain('请输入有效的数字');
    });

    test('should return error for unsupported operation', () => {
      const result = calculator('modulus', '5', '3');
      expect(result).toContain('不支持的运算');
    });
  });

  describe('case insensitivity', () => {
    test('should handle uppercase operation', () => {
      expect(calculator('ADD', '1', '2')).toBe('1 + 2 = 3');
    });

    test('should handle mixed case operation', () => {
      expect(calculator('Multiply', '2', '3')).toBe('2 × 3 = 6');
    });
  });
});
