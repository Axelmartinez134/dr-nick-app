-- Editor: Recent assets (Phase 2)
-- Stores per-user recently used images (uploads + AI images now; logos later).

create table if not exists public.editor_recent_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  storage_bucket text null,
  storage_path text null,
  kind text not null default 'upload',
  last_used_at timestamptz not null default now(),
  use_count integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists editor_recent_assets_owner_last_used_idx
  on public.editor_recent_assets (owner_user_id, last_used_at desc);

-- Dedupe by storage location when present (best), and also by URL.
-- NOTE: unique constraints treat NULLs as distinct, which is OK.
alter table public.editor_recent_assets
  add constraint editor_recent_assets_owner_storage_unique unique (owner_user_id, storage_bucket, storage_path);

alter table public.editor_recent_assets
  add constraint editor_recent_assets_owner_url_unique unique (owner_user_id, url);

alter table public.editor_recent_assets enable row level security;

create policy "editor_recent_assets_select_own"
  on public.editor_recent_assets
  for select
  using (owner_user_id = auth.uid());

create policy "editor_recent_assets_insert_own"
  on public.editor_recent_assets
  for insert
  with check (owner_user_id = auth.uid());

create policy "editor_recent_assets_update_own"
  on public.editor_recent_assets
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

