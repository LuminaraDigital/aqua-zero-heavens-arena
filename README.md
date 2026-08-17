# Aqua Zero Heavens Arena

AGPLv3 open-source card arena. Play offline from a GitHub download. Optional
[TON](https://docs.ton.org/) wallet identity via [TON Connect](https://docs.ton.org/applications/ton-connect/overview).

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

## TON (decentralized path)

Primary product direction: **local game + TON wallet**, not a hosted SaaS backend.

| Layer | What | Status |
|---|---|---|
| Game | Single HTML page, local saves | Shipped |
| License | AGPLv3 | Shipped |
| Wallet | TON Connect (vanilla JS) | Scaffolded in Options |
| Manifest | `tonconnect-manifest.json` | In repo (needs public HTTPS URL) |
| On-chain | Ladder / entry / prizes contracts | Planned (see ADR 0006) |

### Honest constraint (from TON docs)

Wallets fetch `tonconnect-manifest.json` over **HTTPS** with no auth and no
challenge page. Opening a lone `file://` HTML file can play the game, but
**cannot** complete wallet connect until the manifest (and ideally the app) is
reachable at a public HTTPS URL.

Open-source-friendly options:

1. **GitHub Pages** on this repo (recommended for AGPL distribution)
2. Any static host that serves the repo root over HTTPS

Set the public origin in the manifest (`url`, `iconUrl`) after you know the Pages
URL. Optional build env:

```bash
AZHA_TON_MANIFEST_URL=https://YOUR_USER.github.io/YOUR_REPO/tonconnect-manifest.json
```

Docs: [docs.ton.org](https://docs.ton.org/), ADR [0006](docs/adr/0006-ton-connect-and-on-chain.md).

## Optional centralized cloud (not required)

Supabase email auth + `cloud_saves` remains an **optional** sync path when
`AZHA_SUPABASE_*` is set at build time. It is centralized. Prefer TON + local
export for the decentralized AGPL distribution story.

## Build tooling

```bash
npm run build              # bundles src/ into aqua-zero-heavens-arena.html
npm test
npm run check:security
npm run ci
```

Static header configs (`vercel.json`, `netlify.toml`) remain for anyone who
deploys that way. They are not required to download and play from GitHub.
