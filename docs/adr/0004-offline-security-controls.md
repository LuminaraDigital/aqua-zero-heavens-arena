# ADR 0004: Offline security controls

## Status

Accepted

## Context

Aqua Zero Heavens Arena is a static, offline HTML game. Progress lives in `localStorage` and portable `azha-save` files. There is no multi-tenant backend, so server RLS, session auth, WAF, and remote SIEM do not apply. Import still needs defenses against prototype pollution, import spam, and silent reject loss.

## Decision

- Deep-sanitize `run`, `daily`, and `ranking` inside `sanitizeSavePayload`. Nested `__proto__`, `constructor`, and `prototype` reject the payload.
- Client import rate limit: default `IMPORT_RATE_MAX` 10 attempts per `IMPORT_RATE_WINDOW_MS` 60000 ms via `checkImportRateLimit` / `noteImportAttempt`.
- Security event ring buffer under `SECURITY_LOG_KEY` (`azha_security_log`), capped at `SECURITY_LOG_LIMIT` (50), via `appendSecurityEvent` / `readSecurityLog` / `clearSecurityLog`. Erase clears the log.
- Player-facing errors stay message-only (no stack traces). Render catch logs a message string, not a bare `Error` object.
- Server RLS, auth routes, and remote rate limiting remain N/A for this offline static scope.

## Consequences

- Tests in `tests/security.test.js` (plus existing backup suite) lock the contract in `.build/ceo-gates-security.json`.
- Hosting headers stay separate (ADR 0001 / 0002). Save envelope contract stays in [SAVE_FORMAT.md](../SAVE_FORMAT.md).
- Going online later would add real auth/RLS; these client controls would remain a defense-in-depth layer, not a replacement.
