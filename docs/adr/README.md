# Architecture Decision Records

Short ADRs for Aqua Zero Heavens Arena (offline-first static game, optional cloud).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-static-hosting-and-https.md) | Static hosting and HTTPS headers | Accepted |
| [0002](0002-csp-for-single-file-canvas.md) | CSP for single-file canvas | Accepted |
| [0003](0003-local-save-and-backup-format.md) | Local save and backup format | Accepted |
| [0004](0004-offline-security-controls.md) | Offline security controls | Accepted |
| [0005](0005-optional-cloud-saves.md) | Optional cloud saves (Supabase) | Accepted |
| [0006](0006-ton-connect-and-on-chain.md) | TON Connect and on-chain roadmap | Accepted |

## When to add an ADR

Add one when a decision is hard to reverse (hosting model, CSP shape, save envelope versioning, online sync) or when a future engineer would otherwise reinvent controls that do not apply here.
