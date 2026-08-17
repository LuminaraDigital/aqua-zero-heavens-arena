# ADR 0005: Optional cloud saves (Supabase)

## Status

Accepted

## Context

The game ships as one static HTML page with local saves. Players asked for
accounts and cross-device progress. A full SaaS rewrite is out of scope; an
optional sync layer must keep offline play working with zero config.

## Decision

- Use Supabase Auth (email + password) and a single `public.cloud_saves` row
  per `auth.users` id (`save` jsonb, `rev`, `updated_at`).
- Enable RLS so authenticated users only read/write their own row. Never ship
  the service role key.
- Embed only `AZHA_SUPABASE_URL` and `AZHA_SUPABASE_ANON_KEY` at build time via
  `CLOUD_CONFIG`. Empty config means cloud Options rows stay disabled.
- Talk to GoTrue and PostgREST with `fetch` (no supabase-js runtime dependency).
- Conflict rule: higher `rev` wins; equal rev keeps the remote row if present.
- Local vault, export/import, and erase remain primary offline controls. Erase
  while signed in pushes the wiped payload so cloud cannot resurrect progress.
- CSP `connect-src` allows `https://*.supabase.co` on Vercel/Netlify hosts.

## Consequences

- ADR 0001-0004 still describe the offline core; this ADR adds an optional online path.
- Hosted email confirmation settings affect first sign-in; document that in README.
- Multi-device races beyond rev are last-writer-ish; not a multiplayer lobby.
