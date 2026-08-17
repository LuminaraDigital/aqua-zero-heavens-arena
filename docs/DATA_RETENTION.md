# Data retention and deletion

Offline-first static game. Local progress is always in the browser. Optional
Supabase cloud saves store a copy only when the player signs in and syncs.

## What is stored

| Location | Key / artifact | Contents |
|---|---|---|
| `localStorage` | `azha_save` | Live save (display name, mastery, records, options, run). |
| `localStorage` | `azha_save_stamp` | Multi-tab revision stamp (`rev`, `tabId`, `t`). |
| `localStorage` | `azx_save` | Legacy key; read once then re-persisted under `azha_save`. |
| `localStorage` | `azha_save_backups` | Last 5 automatic snapshots. |
| `localStorage` | `azha_cloud_session` | Optional cloud auth session (tokens + email). |
| `localStorage` | `azha_security_log` | Local security event ring buffer. |
| User disk | `azha-save.json` (export) | Portable copy the player chose to download. |
| Supabase (optional) | `public.cloud_saves` | One JSON save row per authenticated user (RLS owner-only). |

Player **display name** (`SAVE.name`) is chosen in-game. Cloud sign-up collects an
**email** for Auth only. Treat both as player data. No payment or government ID.

## Retention

- Local data remains until erase, site-data clear, or browser purge.
- Cloud rows remain until the player erases while signed in (wiped payload pushed),
  deletes the account/row, or an operator deletes the Supabase project.
- Export files persist for as long as the player keeps the file.

## Deletion

1. **In-game Erase Save** (Options): resets live save, clears the backup vault,
   clears the security log, and writes the wipe with `persist(true)`. If signed
   in, the wiped payload is scheduled for cloud push so a later pull cannot
   resurrect progress.
2. **Cloud Sign Out**: clears `azha_cloud_session` only; local save stays.
3. **Complete local wipe:** also remove `azha_save`, `azha_save_stamp`, and
   `azha_cloud_session` via browser site-data clear.
4. **Export files:** delete the JSON file on the player's device.
5. **Host / CDN:** static assets only. Redeploy does not retain player saves.

## Honest limits

- No employee browsing of saves unless they have Supabase project access.
- Cloud delete of the Auth user cascades the `cloud_saves` row (`on delete cascade`).
- Regulatory tamper-evident SIEM remains out of scope.
