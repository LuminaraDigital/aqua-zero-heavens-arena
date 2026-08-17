# ADR 0002: CSP for single-file canvas

## Status

Accepted

## Context

The deliverable is a single HTML page with inline scripts and styles, plus `data:` / `blob:` assets (logo, arena art, save download). A strict CSP without `'unsafe-inline'` would break the page unless the build were rewritten for external bundles and nonces.

## Decision

- Deliver CSP via **host headers** in `vercel.json` / `netlify.toml`.
- Allow `'unsafe-inline'` for `script-src` and `style-src`.
- Allow `data:` and `blob:` where needed for images/media/fonts.
- Keep `object-src 'none'`, `frame-ancestors 'none'`, tight `connect-src 'self'`.
- Do **not** embed a competing CSP via `<meta http-equiv>`; host headers are the source of truth.

## Consequences

- Inline XSS remains a residual risk mitigated by: no third-party script hosts, no user HTML rendering server-side, and offline play with localStorage-only player data.
- Tightening CSP later requires a build that externalizes or hashes scripts; that is a separate ADR.
- Meta CSP must not be added casually; it can conflict with or weaken header policy.
