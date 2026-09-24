# Aqua Zero Heavens Arena

AGPLv3 open-source card arena. Play offline from a GitHub download. No account,
no server, no wallet required — and none of those are on the default path.

## License

This program is free software under the **GNU Affero General Public License
v3.0** (see [LICENSE](LICENSE)). If you modify and run it as a network service,
you must offer the corresponding source to users.

## Play from GitHub (offline)

```bash
git clone <this-repo>
cd <this-repo>
npm run build
# open aqua-zero-heavens-arena.html in a browser
```

Or download the built `aqua-zero-heavens-arena.html` from Releases / the repo and
open it locally. Progress stays in your browser (`localStorage`) unless you
export a save file.

```bash
npm test
npm run ci
```

## Shelved: TON, Supabase, P2P WebRTC

These three were built and are **not** the product direction. The game is a
local, offline, single-file arena; identity, cloud sync and networking are not
part of what it is trying to be, and carrying them on the default path cost
more in menu surface and support than they returned.

Shelved here means: **the code and its test suites stay in the repo**, and they
stay out of the default build, the mode hub and the settings drawer. This is a
reversal of an earlier README that called the TON path the primary direction;
it isn't, and nothing downstream should assume it is. The decision is recorded
in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

| Layer | What | Status |
|---|---|---|
| Game | Single HTML page, local saves | Shipped — this is the product |
| License | AGPLv3 | Shipped |
| Save portability | Export / import a save file, local backups | Shipped |
| Wallet | TON Connect (vanilla JS), `tonconnect-manifest.json` | Shelved — code + suite kept, off by default |
| Cloud sync | Supabase email auth + `cloud_saves` | Shelved — code + suite kept, off by default |
| Peer-to-peer | WebRTC direct duels | Shelved — code + suite kept, off by default |
| On-chain | Ladder / entry / prizes contracts | Not planned (ADR [0006](docs/adr/0006-ton-connect-and-on-chain.md) is history, not a roadmap) |

### Turning one back on

Nothing shelved is wired to anything by default. Supabase and TON are already
inert unless their build env is set:

```bash
AZHA_SUPABASE_URL=...  AZHA_SUPABASE_ANON_KEY=...   npm run build   # cloud sync
AZHA_TON_MANIFEST_URL=https://YOUR_USER.github.io/YOUR_REPO/tonconnect-manifest.json npm run build
```

The `AZHA_SHELVED=0` build flag restores, in one build: the three shelved
battle modules (`judging`, `corner-protocol`, `weight-cut`), the shelved
launch modes (`endless`, `weekly`, `daily`, `tower`, `dojo`, `vs`, `vs2`,
`ghost`, `p2p`) on their menu tabs, and the wallet / cloud / P2P rows in
Options. In the default build none of those are reachable: the modules are
not in the page and the rows are not drawn.

Two constraints worth keeping on record if anyone un-shelves the wallet path:
wallets fetch `tonconnect-manifest.json` over **HTTPS** with no auth, so a lone
`file://` page can play the game but can never complete a wallet connect; and
Supabase is a centralized dependency, which is the opposite of what the offline
single-file distribution is for.

## Build tooling

```bash
npm run build              # bundles src/ into aqua-zero-heavens-arena.html
npm test
npm run docs               # re-measure balance, rewrite the block in ARCHITECTURE.md
npm run check:docs         # fail if the committed docs no longer match the audit
npm run check:security
npm run ci
```

Balance numbers in `ARCHITECTURE.md` are generated, not typed. They come from
`tools/audit-balance.js` via `tools/gen-docs.js`, which also writes
`docs/balance-report.json`. Re-run `npm run docs` after anything that touches
combat.

Static header configs (`vercel.json`, `netlify.toml`) remain for anyone who
deploys that way. They are not required to download and play from GitHub.
