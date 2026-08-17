# ADR 0001: Static hosting and HTTPS

## Status

Accepted

## Context

Aqua Zero Heavens Arena ships as one HTML page built by Node. There is no origin application server, no API, and no player accounts. Production still needs HTTPS and baseline browser security headers.

## Decision

- Host as a **static site** on Vercel, Netlify, or any equivalent static host.
- Put security headers in host config: `vercel.json` and `netlify.toml` (not in application code).
- Required headers: HSTS, CSP (see ADR 0002), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, restrictive `Permissions-Policy`.
- Map `/` to `aqua-zero-heavens-arena.html` via rewrite/redirect.
- Verify with `node tools/check-production-security.js`.

## Consequences

- No origin server to patch, rate-limit, or multi-tenant. Those controls are N/A.
- Header drift is a config review item, not a runtime feature.
- Any host without custom headers must be rejected for production, or headers must be added at the CDN/edge layer.
