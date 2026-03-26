# AGENTS.md

> Authoritative project context for AI agents working on this codebase.

---

## Project Overview

A beginner-friendly **Node.js CLI application** that demonstrates three fundamental concepts:

1. **Command-line argument handling** — personalized greeting
2. **File I/O** — append-only logging to `log.txt`
3. **Simple calculator** — four basic arithmetic operations with input validation

This is a single-file learning project. It is intentionally small and simple.

---

## Tech Stack

| Item               | Detail                          |
| ------------------ | ------------------------------- |
| Runtime            | Node.js (no minimum version)    |
| Module system      | CommonJS (`require` / `module.exports`) |
| External deps      | **None** — stdlib only (`fs`, `path`)   |
| Package manager    | npm                             |
| Test framework     | None (not yet configured)       |

---

## Repository Structure

```
.
├── index.js              # All application code (entry point + library)
├── package.json          # Project metadata, no dependencies
├── log.txt               # Runtime log output (auto-generated, tracked in git)
├── .gitignore            # Ignores node_modules, env files, IDE files, *.log
├── README.md             # Minimal project title
├── CLAUDE.md             # Claude Code specific instructions
├── AGENTS.md             # This file — full project context
└── 初级功能说明.md        # Chinese-language learning guide for beginners
```

### Important: there are no subdirectories

No `src/`, `lib/`, `test/`, `specs/`, or `docs/` directories exist. All logic lives in `index.js`.

> Note: `CLAUDE.md` references `specs/` and `docs/architecture.md` — these do **not** exist. Ignore those references.

---

## How to Run

```bash
# Install (nothing to install — zero dependencies)
# npm install is a no-op but harmless

# Default greeting
node index.js                        # "你好, World! ..."

# Greet by name
node index.js Alice                  # "你好, Alice! ..."
node index.js 小明

# Write a log entry
node index.js log 今天学习了 Node.js
node index.js 日志 今天学习了 Node.js   # Chinese alias

# Read all log entries
node index.js logs
node index.js 查看日志                  # Chinese alias

# Calculator
node index.js add 5 3
node index.js subtract 10 4
node index.js multiply 6 7
node index.js divide 20 4

# Chinese calculator aliases
node index.js 加 5 3
node index.js 减 10 4
node index.js 乘 6 7
node index.js 除 20 4

# Help
node index.js help
node index.js 帮助                     # Chinese alias
```

All commands go through `npm start` as well (without extra args it runs the default greeting).

---

## Architecture & Key Design Decisions

These choices are **intentional** for a beginner learning project. Do not "improve" them unless explicitly asked.

### Single-file design
All logic is in `index.js`. Do not split into multiple modules.

### CommonJS, not ESM
The project uses `require()` / `module.exports`. Do not convert to ES modules.

### Synchronous file I/O
`fs.appendFileSync`, `fs.readFileSync`, and `fs.existsSync` are used deliberately for simplicity. Do not refactor to async/Promise-based I/O.

### Module guard pattern
```js
if (require.main === module) {
  main();
}
```
This allows `index.js` to be both a CLI entry point and an importable module for testing.

### No external dependencies
The project must remain dependency-free. Do not add npm packages.

---

## Code Conventions

### Language

- **Code** (variable names, function names, comments): English
- **User-facing strings** (console output, error messages): Chinese (Simplified)
- **CLI commands**: English primary with Chinese aliases (e.g., `add` / `加`, `help` / `帮助`)

### Formatting

- 2-space indentation (implicit, no formatter configured)
- Single quotes for strings
- Section separators: `// ==================== ... ====================`
- JSDoc-style block comment at the top of the file

### Timestamps

Timestamps use `zh-CN` locale with `Asia/Shanghai` timezone:
```
[2026/03/24 11:46:47]
```
Note: output format is locale-dependent and may vary across Node.js versions and environments.

---

## Exported API

The following functions are exported via `module.exports` for potential testing:

| Function                           | Returns   | Side effects            |
| ---------------------------------- | --------- | ----------------------- |
| `greet(name = 'World')`            | `string`  | None                    |
| `calculator(operation, num1, num2)`| `string`  | None                    |
| `writeLog(message)`                | `void`    | Appends to `log.txt`, writes to stdout |
| `readLog()`                        | `void`    | Reads `log.txt`, writes to stdout      |

`main()` and `showHelp()` are **not** exported.

---

## Testing

There are no tests yet. `package.json` has a placeholder test script that exits with an error.

If adding tests:
- Use a zero-config framework (e.g., Node.js built-in test runner `node --test`, or Jest)
- Test `greet()` and `calculator()` as pure functions
- `writeLog()` and `readLog()` have filesystem side effects — use a temp directory or mock `fs`
- Do not add test dependencies without explicit approval

---

## Working with the Code

### Adding a new command

1. Create a new function in `index.js` (follow the section separator pattern)
2. Add a `case` branch in the `switch` block inside `main()`
3. Include both English and Chinese command aliases if applicable
4. Update `showHelp()` output
5. Export the function in `module.exports` if it should be testable

### Log file behavior

- `log.txt` is created automatically on first write
- Greetings and calculator results are auto-logged (side effect inside `main()`)
- Manual log entries are written via `node index.js log <message>`
- The file grows without bound — there is no rotation or cleanup mechanism

---

## Common Pitfalls

| Pitfall | Detail |
| ------- | ------ |
| `log.txt` is tracked in git | `.gitignore` has `*.log` but the file is named `log.txt`, so it is **not** ignored. Be aware of committing runtime data. |
| No input sanitization | User input is written directly to `log.txt`. There is no escaping or length limit. |
| Division by zero | Handled — returns a Chinese error string. But the error string itself gets logged as a "calculation". |
| Locale-dependent timestamps | `toLocaleString('zh-CN')` output varies by environment. Tests should not assert exact timestamp format. |
| `showHelp()` box drawing | The decorative box in `showHelp()` assumes a monospace terminal with CJK character support. |
| Unrecognized commands become greetings | Any unknown first argument (e.g., a typo like `hlep`) is treated as a name for the greeting function, not an error. |
