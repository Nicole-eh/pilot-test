# AGENTS.md — Coding Agent Guidelines

This document provides essential context for AI coding agents working on this repository.

## Project Overview

A Node.js learning project that progresses from beginner to intermediate concepts. It includes a CLI tool, an HTTP server with RESTful APIs, a TODO system, and JWT-based authentication. The primary language of the codebase comments, UI, and documentation is **Chinese (Simplified)**, but all code identifiers are in English.

## Repository Structure

```
.
├── index.js          # CLI entry point (greet, calculator, logger, todo commands)
├── server.js         # HTTP server with RESTful API routes (users, todos, auth)
├── auth.js           # JWT authentication module (register, login, refresh, RBAC)
├── store.js          # Generic JSON file-backed CRUD storage class (JsonStore)
├── package.json      # Project manifest (Node 20+, dependencies: bcryptjs, jsonwebtoken)
├── test-api.sh       # Shell script for smoke-testing user/todo API endpoints
├── test-auth.sh      # Shell script for smoke-testing JWT auth flow
├── data/
│   ├── users.json    # User records (name, email, age) — auto-generated on first run
│   ├── todos.json    # TODO items — managed by JsonStore
│   └── accounts.json # Auth accounts (username, hashed password, role) — managed by JsonStore
├── log.txt           # Append-only log written by CLI logger
├── README.md         # Project readme (Chinese)
├── 初级功能说明.md    # Beginner features documentation
├── 中级功能说明.md    # Intermediate features documentation
└── 高级功能说明.md    # Advanced features documentation
```

## Tech Stack & Dependencies

- **Runtime**: Node.js (no framework — raw `http`, `fs`, `path`, `url`, `crypto` modules)
- **npm dependencies** (production only):
  - `bcryptjs` ^3.0.3 — password hashing
  - `jsonwebtoken` ^9.0.3 — JWT signing and verification
- **No dev dependencies, no bundler, no TypeScript, no test framework.**

## How to Run

```bash
# Install dependencies (required for auth features)
npm install

# Run the CLI tool
node index.js help

# Start the HTTP server (default port 3000)
node server.js
# or
npm run server

# Run API smoke tests (requires server running)
bash test-api.sh
bash test-auth.sh
```

## Architecture & Key Patterns

### JsonStore (`store.js`)
- A reusable class that persists an array of records to a JSON file.
- Uses atomic writes (write to `.tmp` then `fs.renameSync`) to prevent data corruption.
- Auto-generates integer IDs and timestamps (`createdAt`, `updatedAt`).
- Used by: `index.js` (todos), `server.js` (todos), `auth.js` (accounts).
- **Note**: `server.js` manages users with its own inline array + `saveUsers()` function — it does NOT use JsonStore for users.

### HTTP Server (`server.js`)
- A single-file HTTP server with manual URL-pattern routing (regex matches for parameterized routes like `/api/users/:id`).
- No middleware framework — CORS, body parsing, and response helpers are implemented inline.
- Serves an HTML dashboard at `/` with embedded CSS and JavaScript.
- All API responses follow a consistent envelope: `{ success: boolean, message?: string, data?: any, count?: number }`.
- Listens on `0.0.0.0:3000` by default; port is configurable via `PORT` env var.

### Authentication (`auth.js`)
- Dual-token strategy: short-lived Access Token (15 min) + long-lived Refresh Token (7 days).
- Passwords hashed with bcrypt (10 rounds).
- Role-based access control with two roles: `admin` and `user`.
- Revoked refresh tokens tracked in an in-memory `Set` (not persisted across restarts).
- JWT secrets default to hardcoded strings; override via `JWT_SECRET` and `JWT_REFRESH_SECRET` env vars.

### CLI Tool (`index.js`)
- Dispatches commands via `process.argv` parsing and a `switch` statement.
- Supports Chinese command aliases (e.g., `加` for `add`, `待办` for `todo`).
- Exports functions for potential testing: `greet`, `calculator`, `writeLog`, `readLog`, `todoStore`.

## API Endpoints

### User CRUD (no auth required)

| Method | Path                      | Description         |
|--------|---------------------------|---------------------|
| GET    | `/api/users`              | List all users      |
| GET    | `/api/users/:id`          | Get user by ID      |
| POST   | `/api/users`              | Create user         |
| PUT    | `/api/users/:id`          | Update user         |
| DELETE | `/api/users/:id`          | Delete user         |
| GET    | `/api/stats`              | User statistics     |
| GET    | `/api/users/export/csv`   | Export users as CSV |

### TODO CRUD (no auth required)

| Method | Path              | Description       |
|--------|-------------------|-------------------|
| GET    | `/api/todos`      | List all todos    |
| GET    | `/api/todos/:id`  | Get todo by ID    |
| POST   | `/api/todos`      | Create todo       |
| PUT    | `/api/todos/:id`  | Update todo       |
| DELETE | `/api/todos/:id`  | Delete todo       |

### Authentication (JWT)

| Method | Path                       | Auth Required | Description                  |
|--------|----------------------------|---------------|------------------------------|
| POST   | `/api/auth/register`       | No            | Register new account         |
| POST   | `/api/auth/login`          | No            | Login, returns token pair    |
| POST   | `/api/auth/refresh`        | No            | Refresh access token         |
| POST   | `/api/auth/logout`         | No            | Revoke refresh token         |
| GET    | `/api/auth/profile`        | Bearer token  | Get current user profile     |
| GET    | `/api/auth/accounts`       | Admin only    | List all accounts            |
| DELETE | `/api/auth/accounts/:id`   | Admin only    | Delete an account            |

## Coding Conventions

- **Module system**: CommonJS (`require` / `module.exports`). Do not convert to ESM.
- **Style**: No linter or formatter is configured. Follow the existing style:
  - 2-space indentation.
  - Single quotes for strings.
  - Descriptive function names in camelCase.
  - Chinese comments and user-facing messages; English for identifiers.
- **Error handling**: Synchronous file operations wrapped in try/catch. Async route handlers catch errors and return JSON error responses.
- **No classes except `JsonStore`**: The rest of the codebase uses plain functions.

## Data & State

- All persistent data lives in `data/*.json` files. These are checked into the repo with sample seed data.
- `log.txt` is an append-only file written by the CLI; it is also tracked in git.
- Revoked refresh tokens are stored in memory only (`Set` in `auth.js`) and are lost on server restart.

## Known Limitations & Areas for Improvement

- **No automated tests**: `package.json` has `"test": "echo \"Error: no test specified\" && exit 1"`. The `test-api.sh` and `test-auth.sh` scripts are manual smoke tests that require the server to be running.
- **User storage inconsistency**: `server.js` manages users via an inline array + `saveUsers()`, while todos and accounts use `JsonStore`. Refactoring users to use `JsonStore` would improve consistency.
- **Security**: JWT secrets are hardcoded defaults. The refresh-token revocation list is in-memory only. CORS is wide open (`*`). These are acceptable for a learning project but should be addressed before any production use.
- **No input sanitization**: User input is not sanitized for XSS or injection (again, acceptable for a learning context).
- **Single-file server**: All routes are in `server.js` (~1060 lines). As the project grows, consider extracting route handlers into separate modules.

## Environment Variables

| Variable             | Default                                        | Description              |
|----------------------|------------------------------------------------|--------------------------|
| `PORT`               | `3000`                                         | HTTP server listen port  |
| `JWT_SECRET`         | `my-super-secret-key-change-in-production`     | Access token signing key |
| `JWT_REFRESH_SECRET` | `my-refresh-secret-key-change-in-production`   | Refresh token signing key|

## Testing Changes

Since there is no automated test suite, after making changes:

1. **CLI changes** (`index.js`, `store.js`): Run a few CLI commands manually to verify:
   ```bash
   node index.js help
   node index.js Alice
   node index.js add 5 3
   node index.js todo add "test item"
   node index.js todo list
   ```
2. **Server changes** (`server.js`, `auth.js`, `store.js`): Start the server and run the smoke-test scripts:
   ```bash
   node server.js &
   bash test-api.sh
   bash test-auth.sh
   kill %1
   ```
3. **Verify no syntax errors**: At minimum, ensure `node -c <file>` passes for any changed `.js` file.
