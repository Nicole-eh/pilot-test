#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 初级功能 Node.js 应用
 * 包含：命令行参数、文件读写、简单计算器
 */

// ==================== 功能 1: 命令行参数处理 ====================
function greet(name = 'World') {
  return `你好, ${name}! 👋`;
}

// ==================== 功能 2: 文件读写（日志功能）====================
const LOG_FILE = path.join(__dirname, 'log.txt');
const TODO_FILE = path.join(__dirname, 'data', 'todos.json');

function writeLog(message) {
  const timestamp = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const logEntry = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    console.log('✓ 日志已保存到 log.txt');
  } catch (error) {
    console.error('✗ 保存日志失败:', error.message);
  }
}

function readLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      console.log('📝 还没有日志记录');
      return;
    }
    const logs = fs.readFileSync(LOG_FILE, 'utf8');
    console.log('📋 历史日志：');
    console.log('─────────────────────────────────────');
    console.log(logs);
    console.log('─────────────────────────────────────');
  } catch (error) {
    console.error('✗ 读取日志失败:', error.message);
  }
}

// ==================== 功能 3: 简单计算器 ====================
function calculator(operation, num1, num2) {
  const a = parseFloat(num1);
  const b = parseFloat(num2);

  // 检查数字是否有效
  if (isNaN(a) || isNaN(b)) {
    return '✗ 错误：请输入有效的数字！';
  }

  let result;
  switch (operation.toLowerCase()) {
    case 'add':
    case '加':
      result = a + b;
      return `${a} + ${b} = ${result}`;

    case 'subtract':
    case '减':
      result = a - b;
      return `${a} - ${b} = ${result}`;

    case 'multiply':
    case '乘':
      result = a * b;
      return `${a} × ${b} = ${result}`;

    case 'divide':
    case '除':
      if (b === 0) {
        return '✗ 错误：除数不能为 0！';
      }
      result = a / b;
      return `${a} ÷ ${b} = ${result}`;

    default:
      return `✗ 错误：不支持的运算 "${operation}"\n支持的运算：add(加), subtract(减), multiply(乘), divide(除)`;
  }
}

// ==================== 功能 4: TODO 应用（增删改查）====================

// 读取 TODO 数据
function loadTodos() {
  try {
    if (!fs.existsSync(TODO_FILE)) {
      return [];
    }
    const data = fs.readFileSync(TODO_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('✗ 读取 TODO 数据失败:', error.message);
    return [];
  }
}

// 保存 TODO 数据
function saveTodos(todos) {
  try {
    const dir = path.dirname(TODO_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2), 'utf8');
  } catch (error) {
    console.error('✗ 保存 TODO 数据失败:', error.message);
  }
}

// 添加 TODO
function addTodo(text) {
  if (!text || text.trim().length === 0) {
    console.log('✗ 请输入 TODO 内容');
    return;
  }
  const todos = loadTodos();
  const newTodo = {
    id: todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1,
    text: text.trim(),
    done: false,
    createdAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  };
  todos.push(newTodo);
  saveTodos(todos);
  console.log(`✓ 已添加 TODO #${newTodo.id}: ${newTodo.text}`);
  writeLog(`添加 TODO: ${newTodo.text}`);
}

// 列出所有 TODO
function listTodos() {
  const todos = loadTodos();
  if (todos.length === 0) {
    console.log('📝 还没有任何 TODO，使用 "node index.js todo add <内容>" 添加一个吧！');
    return;
  }

  const pending = todos.filter(t => !t.done);
  const completed = todos.filter(t => t.done);

  console.log('📝 TODO 列表：');
  console.log('─────────────────────────────────────');

  if (pending.length > 0) {
    console.log(`\n📌 待完成 (${pending.length}):`);
    pending.forEach(t => {
      console.log(`  [ ] #${t.id} ${t.text}  (${t.createdAt})`);
    });
  }

  if (completed.length > 0) {
    console.log(`\n✅ 已完成 (${completed.length}):`);
    completed.forEach(t => {
      console.log(`  [x] #${t.id} ${t.text}  (${t.createdAt})`);
    });
  }

  console.log('\n─────────────────────────────────────');
  console.log(`总计: ${todos.length} 项 | 待完成: ${pending.length} | 已完成: ${completed.length}`);
}

// 完成 TODO
function doneTodo(idStr) {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    console.log('✗ 请输入有效的 TODO ID（数字）');
    return;
  }
  const todos = loadTodos();
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    console.log(`✗ 未找到 ID 为 ${id} 的 TODO`);
    return;
  }
  if (todo.done) {
    console.log(`ℹ TODO #${id} 已经是完成状态了`);
    return;
  }
  todo.done = true;
  saveTodos(todos);
  console.log(`✓ 已完成 TODO #${id}: ${todo.text}`);
  writeLog(`完成 TODO: ${todo.text}`);
}

// 删除 TODO
function removeTodo(idStr) {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    console.log('✗ 请输入有效的 TODO ID（数字）');
    return;
  }
  const todos = loadTodos();
  const index = todos.findIndex(t => t.id === id);
  if (index === -1) {
    console.log(`✗ 未找到 ID 为 ${id} 的 TODO`);
    return;
  }
  const removed = todos.splice(index, 1)[0];
  saveTodos(todos);
  console.log(`✓ 已删除 TODO #${id}: ${removed.text}`);
  writeLog(`删除 TODO: ${removed.text}`);
}

// ==================== 显示帮助信息 ====================
function showHelp() {
  console.log(`
╔════════════════════════════════════════════════╗
║     Node.js 初级功能练习项目 🚀               ║
╚════════════════════════════════════════════════╝

📖 使用方法：

【功能 1 - 问候】
  node index.js 小明
  node index.js Alice

【功能 2 - 日志】
  node index.js log 今天学习了 Node.js
  node index.js logs              # 查看所有日志

【功能 3 - 计算器】
  node index.js add 5 3           # 加法：5 + 3
  node index.js subtract 10 4     # 减法：10 - 4
  node index.js multiply 6 7      # 乘法：6 × 7
  node index.js divide 20 4       # 除法：20 ÷ 4

【功能 4 - TODO 应用】
  node index.js todo              # 查看所有 TODO
  node index.js todo add 学习 Node.js  # 添加 TODO
  node index.js todo done 1       # 完成 TODO（按 ID）
  node index.js todo remove 1     # 删除 TODO（按 ID）

【其他】
  node index.js help              # 显示此帮助信息
  node index.js                   # 默认问候

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 提示：中文命令也支持（加、减、乘、除）
  `);
}

// ==================== 主函数 ====================
function main() {
  // 获取命令行参数（跳过前两个：node 和 脚本路径）
  const args = process.argv.slice(2);

  // 如果没有参数，显示默认欢迎信息
  if (args.length === 0) {
    console.log(greet());
    console.log('欢迎使用这个 Node.js 项目！');
    console.log(`Node 版本: ${process.version}`);
    console.log('\n💡 输入 "node index.js help" 查看所有功能');
    return;
  }

  const command = args[0].toLowerCase();

  // 路由到不同功能
  switch (command) {
    case 'help':
    case '帮助':
      showHelp();
      break;

    case 'log':
    case '日志':
      if (args.length < 2) {
        console.log('✗ 用法: node index.js log <消息内容>');
      } else {
        const message = args.slice(1).join(' ');
        writeLog(message);
      }
      break;

    case 'logs':
    case '查看日志':
      readLog();
      break;

    case 'todo':
    case '待办':
      const subCommand = args[1] ? args[1].toLowerCase() : 'list';
      switch (subCommand) {
        case 'add':
        case '添加':
          const todoText = args.slice(2).join(' ');
          addTodo(todoText);
          break;
        case 'done':
        case '完成':
          if (args.length < 3) {
            console.log('✗ 用法: node index.js todo done <ID>');
          } else {
            doneTodo(args[2]);
          }
          break;
        case 'remove':
        case 'delete':
        case '删除':
          if (args.length < 3) {
            console.log('✗ 用法: node index.js todo remove <ID>');
          } else {
            removeTodo(args[2]);
          }
          break;
        case 'list':
        case '列表':
        default:
          listTodos();
          break;
      }
      break;

    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
    case '加':
    case '减':
    case '乘':
    case '除':
      if (args.length < 3) {
        console.log('✗ 用法: node index.js <运算> <数字1> <数字2>');
        console.log('例如: node index.js add 5 3');
      } else {
        const result = calculator(command, args[1], args[2]);
        console.log(result);
        writeLog(`计算: ${result}`);
      }
      break;

    default:
      // 默认作为名字处理（问候功能）
      const name = args.join(' ');
      console.log(greet(name));
      writeLog(`问候了 ${name}`);
      break;
  }
}

// ==================== 运行应用 ====================
if (require.main === module) {
  main();
}

// ==================== 导出供测试 ====================
module.exports = {
  greet,
  calculator,
  writeLog,
  readLog,
  addTodo,
  listTodos,
  doneTodo,
  removeTodo
};
