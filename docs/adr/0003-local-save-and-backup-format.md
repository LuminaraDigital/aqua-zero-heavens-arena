# ADR 0003: Local save and backup format

## Status

Accepted

## Context

Progress must survive refreshes without a backend. Browser storage alone is fragile (site data wipe, quota, accidental erase). Players need a portable file and a short undo vault.

## Decision

- Live save in `localStorage` under `azha_save` (legacy read once from `azx_save`).
- Multi-tab stamp under `azha_save_stamp` (`rev`, `tabId`, `t`). Other tabs adopt a newer stamp via the `storage` event.
- Automatic vault under `azha_save_backups`, capped at the last **5** snapshots (`src/progress/save-backup.js`).
- Portable export/import uses envelope format `azha-save` (JSON). Contract: [SAVE_FORMAT.md](../SAVE_FORMAT.md).
- Erase clears the vault, then uses `persist(true)` so a wiped default is not pushed as the latest restore target.

## Consequences

- No server copy of player progress; backup and DR are local (see [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md)).
- Import rejects non-envelope files and unsupported envelope versions.
- Changing envelope `v` or required payload fields needs tests in `tests/backup.test.js` and a doc update.
