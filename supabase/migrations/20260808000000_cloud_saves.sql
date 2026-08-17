-- Optional cloud saves for Aqua Zero Heavens Arena.
-- One row per authenticated user. RLS: owner only.

create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null,
  rev integer not null default 0 check (rev >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_saves_updated_at_idx
  on public.cloud_saves (updated_at desc);

alter table public.cloud_saves enable row level security;

revoke all on table public.cloud_saves from anon;
grant select, insert, update, delete on table public.cloud_saves to authenticated;

drop policy if exists "cloud_saves_select_own" on public.cloud_saves;
create policy "cloud_saves_select_own"
  on public.cloud_saves
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "cloud_saves_insert_own" on public.cloud_saves;
create policy "cloud_saves_insert_own"
  on public.cloud_saves
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cloud_saves_update_own" on public.cloud_saves;
create policy "cloud_saves_update_own"
  on public.cloud_saves
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cloud_saves_delete_own" on public.cloud_saves;
create policy "cloud_saves_delete_own"
  on public.cloud_saves
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
