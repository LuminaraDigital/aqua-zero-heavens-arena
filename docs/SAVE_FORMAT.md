# Save format contract (`azha-save`)

Portable JSON export/import for Aqua Zero Heavens Arena. Implemented in `src/progress/save-backup.js`; wired from `src/page.template.html`.

This is a **file contract**, not an HTTP API. There is no server endpoint.

## Envelope (required)

| Field | Type | Rules |
|---|---|---|
| `format` | string | Must be exactly `"azha-save"`. |
| `v` | number | Envelope version. Only `1` is accepted. |
| `exportedAt` | number | Epoch ms when exported (`Date.now()`). Present on export; not validated on import. |
| `save` | object | Player save payload (not an array). |

Example:

```json
{
  "format": "azha-save",
  "v": 1,
  "exportedAt": 1720000000000,
  "save": {
    "v": 4,
    "name": "CHALLENGER",
    "unlocked": [0, 1, 2],
    "defeats": {},
    "sound": true,
    "music": true,
    "diff": 1,
    "motion": true,
    "mastery": {},
    "titles": [],
    "title": null,
    "daily": null,
    "run": null,
    "rec": {
      "duels": 0,
      "wins": 0,
      "losses": 0,
      "perfect": 0,
      "stages": 0,
      "bestSurv": 0,
      "ngplus": 0
    },
    "fr": {}
  }
}
```

Default download name: `azha-save.json`.

## Import rejection rules

`importSaveEnvelope(text)` returns `{ ok: false, error }` when:

| Condition | `error` |
|---|---|
| JSON parse fails | `invalid JSON` |
| Root is missing, not an object, or is an array | `not an object` |
| `format !== "azha-save"` | `not an azha-save file` |
| `v !== 1` | `unsupported version` |
| `save` missing, not an object, is an array, or `save.unlocked` is not an array | `invalid save payload` |

On success: `{ ok: true, save }`. The page then `applyImportedSave` (merge onto `DEF_SAVE` defaults) and `persist()`.

## Live save payload (`save`)

Current schema version inside the payload: **`save.v === 4`** (`DEF_SAVE` in the page).

| Field | Meaning |
|---|---|
| `v` | Save schema version (migrated on load for older saves). |
| `name` | Player display name (local only). |
| `unlocked` | Fighter indices marked mastered (required for import). |
| `defeats` | Defeat bookkeeping map. |
| `sound`, `music`, `motion` | Options booleans. |
| `diff` | Difficulty index. |
| `mastery` | Per-fighter mastery map. |
| `titles`, `title` | Title unlocks / current title. |
| `daily` | Daily mode progress or null. Deep-sanitized; nested `__proto__` / `constructor` / `prototype` reject the payload. |
| `run` | In-progress adventure run or null. Same deep-sanitize reject rules as `daily`. |
| `ranking` | Optional ladder store `{ players, audit }`. Preserved through `sanitizeSavePayload` / `importSaveEnvelope` when safe; dangerous nested keys reject. |
| `rec` | Career record counters. |
| `fr` | Fighter record map. |

Load-time migrations (in-page `load()`): v1/v2 roster index slide to v3; v3 gains mastery/titles/daily fields as v4. Export wraps whatever is currently in `SAVE`.

## Security reject behaviors (client)

Offline-only controls in `src/progress/save-backup.js` (no server auth/RLS):

| Condition | Behavior |
|---|---|
| Dangerous keys at any depth in `save`, `run`, `daily`, or `ranking` (`__proto__`, `constructor`, `prototype`) | `sanitizeSavePayload` returns `null`; `importSaveEnvelope` returns `{ ok: false, error: "invalid save payload" }` (or unsafe-keys equivalent). A security event is appended. |
| Import attempts exceed `IMPORT_RATE_MAX` (default 10) inside `IMPORT_RATE_WINDOW_MS` (default 60s) | Import is blocked with a clear error and `retryAfterMs`; a rate-limit security event is logged. |
| Security event log | Ring buffer under `localStorage` key `azha_security_log` (`SECURITY_LOG_KEY`), capped at `SECURITY_LOG_LIMIT` (50). Erase clears it. |

## Backup vault (not the export file)

Key: `azha_save_backups`. Shape: `{ snaps: [ { t, v, save }, ... ] }` with at most **5** snaps. Separate from the `azha-save` envelope. Live key: `azha_save` (legacy `azx_save` read once).

## Optional cloud row (Supabase)

Table: `public.cloud_saves` (`user_id`, `save` jsonb, `rev`, `updated_at`). Same inner `save` schema as local. Conflict: higher `rev` wins. See [ADR 0005](adr/0005-optional-cloud-saves.md).

## Versioning policy

- Bump **envelope** `v` only when the wrapper shape or acceptance rules change; reject older/newer until supported.
- Bump **`save.v`** when the payload schema needs migration; keep import accepting any payload that still has `unlocked: array`, then migrate on load/apply.
- Add tests in `tests/backup.test.js` for every rejection or migration change.
