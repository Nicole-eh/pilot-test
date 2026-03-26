# AGENTS.md

## Project Overview

This is a beginner-friendly Node.js CLI application (`basic-nodejs-project`) that demonstrates three core features: greeting via command-line arguments, file-based logging, and a simple calculator. The project is written in Chinese (Simplified) with bilingual command support (English and Chinese). It serves as an educational tool for learning Node.js fundamentals.

## Tech Stack

- **Runtime:** Node.js (no minimum version specified; uses CommonJS modules)
- **Language:** JavaScript (ES6+, CommonJS `require`/`module.exports`)
- **Dependencies:** None — only Node.js built-in modules (`fs`, `path`)
- **Package manager:** npm

## Repository Structure

```
.
├── index.js            # Main application — all logic lives here
├── package.json        # Project metadata and scripts
├── log.txt             # Runtime-generated log file (append-only)
├── README.md           # Project title
├── 初级功能说明.md       # Detailed feature documentation and learning guide (Chinese)
├── .gitignore          # Standard Node.js gitignore
└── AGENTS.md           # This file
```

## Architecture & Key Patterns

### Single-file design

All application logic is in `index.js`. There are no separate modules, routes, or config files. Functions are defined at the top level and wired together through a `main()` function that parses `process.argv`.

### Command routing

The `main()` function uses a `switch` statement on `args[0]` to route to the correct feature:

| Command | Function | Description |
|---|---|---|
| `<name>` (default) | `greet(name)` | Personalized greeting |
| `log <message>` | `writeLog(message)` | Append a timestamped entry to `log.txt` |
| `logs` | `readLog()` | Print all log entries |
| `add/subtract/multiply/divide <n1> <n2>` | `calculator(op, n1, n2)` | Basic arithmetic |
| `help` | `showHelp()` | Print usage instructions |

Chinese aliases are supported for all commands (e.g., `加`, `减`, `乘`, `除`, `日志`, `帮助`).

### Module exports

Functions are exported via `module.exports` for testability:
```js
module.exports = { greet, calculator, writeLog, readLog };
```

## Running the Application

```bash
# Default greeting
npm start            # or: node index.js

# Greet by name
node index.js Alice

# Log a message
node index.js log "Learned something new"

# View logs
node index.js logs

# Calculator
node index.js add 5 3
node index.js divide 20 4

# Help
node index.js help
```

## Testing

There is currently **no test suite**. The `test` script in `package.json` is a placeholder:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

If adding tests, follow these guidelines:
- Use a lightweight framework (e.g., Node.js built-in `node:test`, or `jest`)
- Test the exported functions (`greet`, `calculator`, `writeLog`, `readLog`) directly
- For `writeLog`/`readLog`, use a temporary directory to avoid polluting the project `log.txt`
- The `calculator` function returns strings, not numbers — assert on the full string output

## Code Style & Conventions

- **Language in code:** Comments, console output, and error messages are in Chinese (Simplified). Maintain this convention.
- **Function style:** Named `function` declarations (not arrow functions at the top level)
- **Error handling:** `try...catch` around all file system operations; user-facing errors prefixed with `✗`, successes with `✓`
- **String formatting:** Template literals (backticks) for all interpolated strings
- **No semicolons rule?** Semicolons ARE used — keep using them
- **Indentation:** 2 spaces
- **No linter or formatter** is configured — keep code consistent with existing style

## Important Conventions When Making Changes

1. **Keep it beginner-friendly.** This is a learning project. Avoid over-engineering, complex abstractions, or advanced patterns that would confuse a beginner.
2. **Preserve bilingual support.** Any new command should support both an English keyword and a Chinese keyword.
3. **Log side effects.** Calculator results and greetings are automatically logged to `log.txt` via `writeLog()`. New features that perform actions should follow this pattern.
4. **Maintain single-file simplicity.** Do not split into multiple files unless the project scope has explicitly grown to warrant it.
5. **No external dependencies** unless explicitly requested. The zero-dependency approach is intentional.
6. **Timestamps use China Standard Time** (`Asia/Shanghai` timezone, `zh-CN` locale). Preserve this in any time-related code.
7. **`log.txt` is a runtime artifact.** It is not checked into version control for its content — but the file currently exists in the repo. New features should not depend on its contents being stable.

## Common Pitfalls

- **`log.txt` path:** The log file path is derived via `path.join(__dirname, 'log.txt')`, so it always writes next to `index.js` regardless of the caller's working directory. Be aware of this when testing.
- **`calculator` returns strings:** It returns formatted result strings (e.g., `"5 + 3 = 8"`), not numeric values. Error cases also return strings starting with `✗`.
- **Division by zero:** Already handled — returns an error string, does not throw.
- **`parseFloat` quirks:** `parseFloat("10abc")` returns `10` (not `NaN`). The current code does not guard against this; be aware if tightening validation.
- **No async code:** Everything is synchronous (`readFileSync`, `appendFileSync`). If introducing async operations, handle the transition carefully since `main()` is synchronous.
