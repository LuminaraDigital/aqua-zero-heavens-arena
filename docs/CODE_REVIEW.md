# Code review standards

Offline static game. Review for correctness and local-data safety, not SaaS controls.

## Must check

1. **Tests.** New or changed behavior has coverage, or an explicit reason why not. Run `node tests/run-tests.js` (or the CI job) before merge when combat, save, build, or UI input paths changed.
2. **No secrets.** No API keys, tokens, credentials, or private URLs in source, configs, or commits. This product has no backend auth; do not invent one in a PR.
3. **Save format compatibility.** Changes to `SAVE`, `exportSaveBlob`, `importSaveEnvelope`, `persist`, or localStorage keys must keep `azha-save` v1 importable, or bump envelope/`SAVE.v` with a migration path. See [SAVE_FORMAT.md](SAVE_FORMAT.md). Do not break restore from the last-5 backup vault without a test.
4. **Security headers (host config only).** If the PR touches `vercel.json`, `netlify.toml`, or `tools/check-production-security.js`, verify HSTS, CSP, frame deny, nosniff, referrer, and Permissions-Policy still match the single-file canvas needs. Run `node tools/check-production-security.js`.
5. **Accessibility (UI changes).** Canvas/menu changes should keep keyboard and pointer paths working (arrows, confirm/cancel, hover+click parity). Do not remove visible focus/selection cues without a replacement. Labels and option blurbs stay readable.
6. **Em-dash ban.** Project rule: no Unicode em dash (U+2014) or en dash in new copy under review. Use hyphen-minus or a colon.
7. **ASCII in `src/`.** Non-ASCII in modules must go through the build escape path; do not ship raw non-ASCII in concatenated sources.

## Not in scope for review theater

Auth/roles, session tokens, multi-tenant isolation, server rate limits, and regulatory tamper-evident logging do not apply. Do not block PRs for inventing them.

## PR expectations

- One clear purpose; keep unrelated refactors out.
- Describe save/migration impact if any.
- Re-measure combat if `TECH_DMG_SCALE`, range, position, or roster tune changed (`node tools/audit-balance.js`).
- Link or quote the failing check when fixing CI.
- Prefer small diffs that a reviewer can run locally without a server.
