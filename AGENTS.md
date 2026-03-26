# AGENTS.md

## Project Overview

This is a beginner-friendly Node.js CLI application (`basic-nodejs-project`) that demonstrates three core features: personalized greeting, file-based logging, and a simple calculator. The entire application lives in a single `index.js` entry point with no external dependencies. It supports both English and Chinese commands.

## Tech Stack

- **Runtime**: Node.js (no minimum version required; uses only built-in modules)
- **Language**: JavaScript (CommonJS modules)
- **Dependencies**: None -- only Node.js built-in modules (`fs`, `path`)
- **Package manager**: npm

## Repository Structure

```
.
├── index.js              # Main application (all features in one file)
├── package.json          # Project metadata and scripts
├── log.txt               # Auto-generated log file (append-only)
├── README.md             # Brief project title
├── .gitignore            # Standard Node.js ignores
└── AGENTS.md             # This file
```

## Running the Application

```bash
# Default greeting
node index.js

# Greet a specific name
node index.js Alice

# Write a log entry
node index.js log <message>

# View all log entries
node index.js logs

# Calculator (supports: add, subtract, multiply, divide)
node index.js add 5 3
node index.js divide 20 4

# Show help
node index.js help
```

Chinese command aliases are also supported: `加`, `减`, `乘`, `除`, `日志`, `查看日志`, `帮助`.

## Architecture & Key Design Decisions

- **Single-file design**: All logic is in `index.js`. This is intentional for beginner accessibility -- do not split into multiple modules without explicit direction.
- **CommonJS**: The project uses `require()` / `module.exports`, not ES modules.
- **Synchronous file I/O**: Log operations use `fs.appendFileSync` and `fs.readFileSync`. This is deliberate for simplicity.
- **Command routing**: The `main()` function parses `process.argv` and uses a `switch` statement to route to the appropriate feature function.
- **Module guard**: `if (require.main === module)` ensures `main()` only runs when executed directly, not when imported.
- **Exported API**: `greet`, `calculator`, `writeLog`, and `readLog` are exported via `module.exports` for potential testing.

## Code Conventions

- Use descriptive function names in English.
- User-facing strings (console output, error messages) are in Chinese.
- Comments in the source code are in Chinese.
- Use visual separators (`// ====...====`) to delineate feature sections in `index.js`.
- Error messages are prefixed with `x` and success messages with a checkmark for visual clarity in terminal output.
- Timestamps use the `Asia/Shanghai` timezone in `zh-CN` locale format.

## Working with the Code

### Adding a new command

1. Create a new function for the feature logic.
2. Add a new `case` in the `switch` block inside `main()`.
3. If the command has a Chinese alias, add that as an additional `case`.
4. Export the function in `module.exports` if it should be testable.

### Log file behavior

- `log.txt` is created automatically on first write. Do not commit it with test data.
- Each entry is one line: `[timestamp] message`.
- The file is append-only; there is no delete/clear mechanism.

## Testing

There are no tests configured yet. The `test` script in `package.json` is a placeholder:

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

If adding tests, the exported functions (`greet`, `calculator`, `writeLog`, `readLog`) are designed to be importable. A test framework like Jest or the built-in `node:test` module would be appropriate.

## Common Pitfalls

- **`log.txt` in `.gitignore`**: The `.gitignore` includes `*.log` but not `*.txt`, so `log.txt` will be tracked by git. Be careful not to commit noisy log data.
- **No input sanitization beyond numeric validation**: The calculator validates numbers with `parseFloat`/`isNaN`, but other commands pass input directly to log or output.
- **Division by zero**: Handled explicitly in the `calculator` function -- returns an error string rather than throwing.
- **Locale-dependent timestamps**: Log timestamps depend on the system's ability to format `zh-CN` locale with `Asia/Shanghai` timezone.
