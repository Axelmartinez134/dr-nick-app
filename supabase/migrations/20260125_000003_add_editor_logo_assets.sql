-- Phase 3A (Logos): global shared raster cache (PNG) for logo variants
-- Provider-agnostic; rows are shared across all editor users once cached.

create table if not exists public.editor_logo_assets (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_key text not null,
  variant_key text not null,
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  content_type text not null default 'image/png',
  width integer null,
  height integer null,
  sha256 text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz null,
  use_count integer not null default 0
);

create unique index if not exists editor_logo_assets_source_variant_uq
  on public.editor_logo_assets (source, source_key, variant_key);

create unique index if not exists editor_logo_assets_storage_uq
  on public.editor_logo_assets (storage_bucket, storage_path);

create index if not exists editor_logo_assets_last_used_idx
  on public.editor_logo_assets (last_used_at desc);

alter table public.editor_logo_assets enable row level security;

-- Conservative: allow SELECT only for editor allowlisted users.
create policy "editor_logo_assets_select_editor_users"
  on public.editor_logo_assets
  for select
  using (exists (select 1 from public.editor_users eu where eu.user_id = auth.uid()));

