# Security Audit Report

**Project:** nodejs-learning-project v2.0.0
**Date:** 2026-03-30
**Auditor:** Pilot (Automated Security Audit)
**Scope:** Full codebase review (server.js, auth.js, store.js, index.js, data/, configuration)

---

## Executive Summary

This audit identified **14 security issues** across the Node.js HTTP server + JWT authentication project. The issues range from **CRITICAL** (hardcoded secrets, open CORS, privilege escalation) to **LOW** (missing security headers, information disclosure). All CRITICAL and HIGH issues have been **automatically remediated** in this commit.

---

## Findings

### CRITICAL Severity

#### 1. Hardcoded JWT Secrets (CWE-798)
- **File:** `auth.js:23-24`
- **Issue:** JWT_SECRET and JWT_REFRESH_SECRET have hardcoded fallback values (`'my-super-secret-key-change-in-production'`). If environment variables are not set, the application uses predictable secrets, allowing any attacker to forge valid JWT tokens.
- **Fix:** Application now refuses to start if JWT secrets are not configured via environment variables.

#### 2. Unrestricted Role Assignment at Registration (CWE-269)
- **File:** `auth.js:212`
- **Issue:** Any user can register with `role: "admin"` by simply passing it in the request body. There is no authorization check on the registration endpoint — anyone can escalate to admin privileges.
- **Fix:** Registration now always assigns the `"user"` role. Admin accounts must be promoted through other means.

#### 3. Wildcard CORS Policy (CWE-942)
- **File:** `server.js:81, 107, 858`
- **Issue:** `Access-Control-Allow-Origin: '*'` allows any website to make authenticated API requests to this server, enabling CSRF-like cross-origin attacks against authenticated users.
- **Fix:** CORS origin is now configurable via the `CORS_ORIGIN` environment variable (defaults to `http://localhost:3000`).

### HIGH Severity

#### 4. No Request Body Size Limit (CWE-400)
- **File:** `server.js:60-75`
- **Issue:** The `parseBody()` function accumulates request body data without any size limit. An attacker can send an extremely large payload to exhaust server memory (Denial of Service).
- **Fix:** Added a 1MB body size limit to `parseBody()`.

#### 5. No Rate Limiting on Authentication Endpoints (CWE-307)
- **File:** `server.js` (auth routes)
- **Issue:** Login, registration, and token refresh endpoints have no rate limiting, allowing brute-force password attacks and credential stuffing.
- **Fix:** Added in-memory rate limiter (15 requests per 15-minute window per IP) on auth endpoints.

#### 6. Revoked Token Store Memory Leak (CWE-401)
- **File:** `auth.js:45`
- **Issue:** `revokedTokens` is an in-memory `Set` that grows indefinitely. Over time (or via targeted logout flooding), this will exhaust server memory.
- **Fix:** Converted to a `Map` with expiration timestamps; stale entries are periodically cleaned up.

### MEDIUM Severity

#### 7. Internal Error Messages Exposed to Client (CWE-209)
- **File:** `server.js:1019, 429, 444, 459, 473`
- **Issue:** Raw `error.message` is sent directly in API responses, potentially leaking internal implementation details (file paths, stack frames, library internals).
- **Fix:** Generic error messages are returned to clients; detailed errors are logged server-side only.

#### 8. Missing Security HTTP Headers (CWE-693)
- **File:** `server.js` (all responses)
- **Issue:** No security headers set: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `Content-Security-Policy`.
- **Fix:** Added security headers to all responses.

#### 9. Deprecated URL Parsing (CWE-20)
- **File:** `server.js:849`
- **Issue:** `url.parse()` is deprecated and has known inconsistencies in URL parsing that can lead to security bypasses. The WHATWG `URL` API should be used instead.
- **Fix:** Replaced with `new URL()` WHATWG API.

#### 10. Insufficient Password Complexity Requirements (CWE-521)
- **File:** `auth.js:201`
- **Issue:** Only a minimum length of 6 characters is enforced. No complexity requirements (uppercase, lowercase, digits, special characters).
- **Fix:** Added password complexity validation requiring uppercase, lowercase, and digit.

### LOW Severity

#### 11. User Data Stored Without Encryption (CWE-312)
- **File:** `data/accounts.json`, `data/users.json`
- **Issue:** While passwords are bcrypt-hashed (good), all other data is stored in plaintext JSON files. Sensitive fields like emails are not encrypted at rest.
- **Recommendation:** For production, use an encrypted database or encrypt sensitive fields.

#### 12. No HTTPS / TLS Configuration (CWE-319)
- **File:** `server.js:1028`
- **Issue:** Server binds on plain HTTP. All data (including JWT tokens and passwords) is transmitted in cleartext.
- **Recommendation:** Use HTTPS in production (terminate TLS at reverse proxy or use `https.createServer()`).

#### 13. Accounts Data File Tracked in Git (CWE-532)
- **File:** `.gitignore`, `data/accounts.json`
- **Issue:** The `data/` directory containing hashed passwords is not gitignored, meaning credential hashes may be committed to version control.
- **Fix:** Added `data/` to `.gitignore`.

#### 14. Predictable Sequential User IDs (CWE-330)
- **File:** `store.js:62`, `server.js:209`
- **Issue:** User/account IDs are sequential integers, making enumeration trivial.
- **Recommendation:** Consider using UUIDs for production systems.

---

## Dependency Analysis

| Package | Version | Status |
|---------|---------|--------|
| bcryptjs | 3.0.3 | No known vulnerabilities |
| jsonwebtoken | 9.0.3 | No known vulnerabilities |

**Note:** `npm audit` was unable to connect to the registry. Manual review of dependency versions shows current stable releases.

---

## Remediation Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | CRITICAL | Hardcoded JWT secrets | FIXED |
| 2 | CRITICAL | Unrestricted admin registration | FIXED |
| 3 | CRITICAL | Wildcard CORS | FIXED |
| 4 | HIGH | No body size limit | FIXED |
| 5 | HIGH | No rate limiting | FIXED |
| 6 | HIGH | Token revocation memory leak | FIXED |
| 7 | MEDIUM | Error message disclosure | FIXED |
| 8 | MEDIUM | Missing security headers | FIXED |
| 9 | MEDIUM | Deprecated URL parsing | FIXED |
| 10 | MEDIUM | Weak password policy | FIXED |
| 11 | LOW | Plaintext data storage | Advisory |
| 12 | LOW | No HTTPS | Advisory |
| 13 | LOW | Data dir not gitignored | FIXED |
| 14 | LOW | Sequential IDs | Advisory |

**Total Fixed: 11 | Advisory Only: 3**
