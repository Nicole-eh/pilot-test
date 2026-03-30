# AGENTS.md — Coding Agent Guide for nodejs-learning-project

## Project Overview

This is a **zero-dependency Node.js learning project** (beginner to intermediate) written entirely in JavaScript using only Node.js built-in modules. It contains two main components:

1. **CLI Tool** (`index.js`) — Command-line app with greeting, logging, and calculator features.
2. **HTTP Server + REST API** (`server.js`) — A user management CRUD API with JSON persistence, CSV export, statistics, and a web UI.

The project is Chinese-language oriented — all user-facing strings, comments, error messages, and documentation are in Chinese (Simplified). The codebase itself uses English identifiers and standard JS conventions.

## Architecture

```
repo/
├── index.js              # CLI entry point (beginner features)
├── server.js             # HTTP server + REST API (intermediate features)
├── package.json          # Project metadata, npm scripts (no dependencies)
├── data/
│   └── users.json        # Persistent user data (JSON file, auto-generated)
├── log.txt               # CLI log output (append-only, auto-generated)
├── test-api.sh           # Bash script for API integration testing
├── README.md             # Project overview (Chinese)
├── 初级功能说明.md        # Beginner features documentation
├── 中级功能说明.md        # Intermediate features documentation
└── .gitignore
```

### index.js (CLI Tool)

- Entry: `main()` reads `process.argv`, routes to `greet()`, `writeLog()`/`readLog()`, or `calculator()`.
- Uses `fs` (sync) and `path` modules only.
- Exports functions for testability: `greet`, `calculator`, `writeLog`, `readLog`.
- Log file path: `log.txt` in project root (append-only via `fs.appendFileSync`).
- Supports both English and Chinese command aliases (e.g., `add`/`加`, `help`/`帮助`).

### server.js (HTTP Server)

- Single-file server using Node.js `http`, `url`, `fs`, `path` modules.
- In-memory `users` array loaded from `data/users.json` at startup; written back on every mutation via `saveUsers()`.
- Request body parsed with a custom `parseBody()` returning a Promise.
- Response helpers: `sendJSON()`, `sendHTML()`, `sendCSV()`, `sendText()`.
- Routing is manual `if/else` + regex matching inside `http.createServer()` callback.
- CORS enabled via `Access-Control-Allow-Origin: *`.
- Graceful shutdown on SIGTERM/SIGINT.
- Listens on `process.env.PORT || 3000`, bound to `0.0.0.0`.
- Exports `{ server }` for programmatic use.

### API Endpoints

| Method | Path                     | Handler              | Description          |
|--------|--------------------------|----------------------|----------------------|
| GET    | `/`                      | `getHomePage()`      | HTML dashboard       |
| GET    | `/api/users`             | `handleGetUsers`     | List all users       |
| GET    | `/api/users/:id`         | `handleGetUser`      | Get user by ID       |
| POST   | `/api/users`             | `handleCreateUser`   | Create user          |
| PUT    | `/api/users/:id`         | `handleUpdateUser`   | Update user          |
| DELETE | `/api/users/:id`         | `handleDeleteUser`   | Delete user          |
| GET    | `/api/stats`             | `handleGetStats`     | User statistics      |
| GET    | `/api/users/export/csv`  | `handleExportCSV`    | Download CSV export  |

### User Schema

```json
{
  "id": 1,
  "name": "张三",
  "email": "zhangsan@example.com",
  "age": 25,
  "createdAt": "2026-03-24T04:33:33.214Z",
  "updatedAt": "2026-03-24T05:00:00.000Z"  // only after PUT
}
```

- `name` and `email` are required on creation. `email` must be unique.
- `age` defaults to `0` if omitted.
- `id` is auto-incremented (`Math.max(...ids) + 1`).

## Key Conventions and Constraints

### Zero Dependencies

This project intentionally uses **no npm packages**. Do not add `express`, `lodash`, database drivers, or any other external dependency. All functionality must use Node.js built-in modules only. There is no `node_modules/` directory and no `package-lock.json`.

### Language

- All user-facing output (console messages, API responses, HTML, error messages) must be in **Chinese (Simplified)**.
- Code identifiers (variable names, function names) should remain in **English**.
- Documentation files (`.md`) are written in Chinese.
- Comments in source code are in Chinese.

### Code Style

- No linter or formatter is configured. Follow the existing style:
  - 2-space indentation.
  - Single quotes for strings.
  - `const`/`let` (no `var`).
  - Semicolons required.
  - Functions use both `function` declarations and arrow functions contextually.
- Section separators in source use `// ======= <title> =======` comment blocks.

### Data Files

- `data/users.json` — Auto-generated on first run if missing. The `data/` directory is created automatically. This file is tracked in git.
- `log.txt` — Append-only log from CLI usage. Also tracked in git.
- Neither file should be manually edited during development; they are runtime artifacts.

### No Test Framework

There is no test framework installed. The only test mechanism is `test-api.sh`, a bash script that uses `curl` against a running server. If adding tests, keep them simple and dependency-free (e.g., Node.js `assert` module).

## Running the Project

```bash
# CLI tool (no server needed)
node index.js help
node index.js <name>
node index.js add 5 3
node index.js log <message>
node index.js logs

# HTTP server
node server.js          # or: npm run server / npm run dev
# Then visit http://localhost:3000

# API tests (requires running server)
chmod +x test-api.sh && ./test-api.sh
```

## Common Modification Patterns

### Adding a new API endpoint

1. Write a handler function (e.g., `handleNewFeature(req, res)`) in the "API route handlers" section of `server.js`.
2. Add routing logic inside the `http.createServer` callback, following the existing `if/else` pattern.
3. Use `sendJSON()` for responses; include `{ success: true/false, ... }` envelope.
4. Use appropriate HTTP status codes (200, 201, 400, 404, 500).

### Adding a new CLI command

1. Add a `case` branch in the `switch` statement inside `main()` in `index.js`.
2. Support both English and Chinese command names.
3. Log the action via `writeLog()` if appropriate.

### Modifying data schema

1. Update the initial seed data in `server.js` (the `users = [...]` block).
2. Update `usersToCSV()` headers and row mapping.
3. Update `getStatistics()` if the new field is numeric/aggregatable.
4. Update validation in `handleCreateUser` and `handleUpdateUser`.

## Potential Pitfalls

- **Route order matters**: `/api/users/export/csv` must be matched *before* the `/api/users/:id` regex pattern, or it will be captured as `id = "export"`. The current code handles this correctly — preserve this ordering.
- **ID generation**: Uses `Math.max(...users.map(u => u.id)) + 1`, which throws on empty arrays in some engines. Currently guarded by a ternary check — do not remove that guard.
- **Synchronous file I/O**: `saveUsers()` uses `fs.writeFileSync`, which blocks the event loop. Acceptable for a learning project, but do not add heavy data operations without considering async alternatives.
- **No input sanitization for HTML**: The homepage is a static template, but user data is returned as JSON, not rendered in HTML. If adding server-side HTML rendering of user data, add proper escaping.
- **CORS is fully open** (`*`): Intentional for learning/development. Do not tighten this without discussion.
