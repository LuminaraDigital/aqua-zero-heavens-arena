# ADR 0006: TON Connect and on-chain roadmap

## Status

Accepted (direction). Wallet scaffold in progress. On-chain contracts not shipped.

## Context

Distribution goal: AGPLv3 source on GitHub so anyone can download and play.
Product goal: a **decentralized TON** game ([TON docs](https://docs.ton.org/)),
not a proprietary hosted backend.

TON Connect is the standard wallet link for TON dApps
([overview](https://docs.ton.org/applications/ton-connect/overview),
[get started](https://docs.ton.org/applications/ton-connect/get-started)). It
does not by itself talk to the chain; contracts and APIs come next.

## Decision

1. **License:** AGPLv3 for the game and network-service modifications.
2. **Offline-first:** the HTML page and local saves remain playable with no wallet.
3. **Identity:** optional TON wallet via `@tonconnect/ui` (vanilla JS), loaded
   only when the player chooses Connect in Options.
4. **Manifest:** ship `tonconnect-manifest.json` in the repo. Operators must
   serve it over HTTPS (GitHub Pages or equivalent) before wallets will connect.
5. **Centralized cloud (Supabase):** optional, secondary. Not required for AGPL
   GitHub play. Do not treat it as the decentralized path.
6. **On-chain (later phases):**
   - Phase A: connect + show address; bind local ladder display name to wallet.
   - Phase B: Tolk/FunC contracts for ranked entry, results commit, or prizes.
   - Phase C: optional Jetton / NFT cosmetics. Never block core offline play.

## Consequences

- CSP must allow TON Connect script CDN (or a vendored copy) and wallet bridge
  HTTPS endpoints when Connect is used.
- `file://` play stays valid for offline; wallet features need an HTTPS origin.
- AGPL network-use clause applies if someone hosts a modified copy as a service.
