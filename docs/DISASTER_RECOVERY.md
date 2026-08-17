# Disaster recovery (RTO / RPO)

Scope: offline static game. Player progress lives in the browser (and optional export files). The "production system" for the product binary is static hosting of one HTML page.

## Player progress

| Control | RPO (approx) | RTO (approx) | Notes |
|---|---|---|---|
| Automatic vault (`azha_save_backups`, last 5) | Last successful `persist` that wrote a new snap | Seconds (Options > restore backup) | Same origin/browser only. |
| Export file (`azha-save.json`) | Time of last export | Minutes (import file) | Cold backup on player-controlled storage. |
| Live `azha_save` only | Continuous while playing | N/A if wiped | Single copy; fragile. |
| Multi-tab stamp (`azha_save_stamp`) | Last persist from any tab | Immediate adopt on `storage` | Other tabs reload live save when stamp rev advances. |

### Hard limit

If the player clears site data **without** an export file (and without a usable vault on that same origin), progress is **unrecoverable**. There is no cloud restore. Document this in support answers; do not claim multi-region player-data DR.

## Static site (game binary)

| Event | RPO | RTO | Action |
|---|---|---|---|
| Bad deploy / broken page | Last known-good git commit / prior deploy | Typically minutes: redeploy previous artifact on Vercel/Netlify | Rollback via host UI or git revert + redeploy. |
| Host outage | N/A for player saves (local) | Host-dependent | Players with a cached or downloaded HTML can still play offline from a local file if they have one; origin headers only apply when served from the host. |
| Repo loss | Git remotes / mirrors | Restore from remote | Keep the canonical repo pushed; ROM inputs live in-repo under `assets/rom/`. |

Suggested targets (honest, not SLA theater):

- **Site RTO:** under 1 hour for a static redeploy/rollback by someone with host access.
- **Site RPO:** last green commit (content), not continuous.
- **Player data RPO/RTO:** owned by the player via vault + export; operator cannot improve browser wipe outcomes without adding a server (out of scope).

## What we do not claim

- Cross-device sync, geo-redundant player databases, or full chaos drills against remote dependencies.
- Guaranteed recovery after OS reimage without an export.
- Network retry / circuit breakers (no remote player API).
- Compliance certifications tied to SaaS DR questionnaires; answer those items as N/A for this product shape.
