-- Phase 3A (Logos): global logo catalog for fast search + tag filtering
-- Provider-agnostic; populated manually by an ingestion script in later phase.

create table if not exists public.editor_logo_catalog (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_key text not null,
  title text not null,
  website text null,
  website_domain text null,
  tags text[] not null default '{}'::text[],
  variants jsonb not null default '[]'::jsonb,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists editor_logo_catalog_source_key_uq
  on public.editor_logo_catalog (source, source_key);

create index if not exists editor_logo_catalog_tags_gin
  on public.editor_logo_catalog using gin (tags);

create index if not exists editor_logo_catalog_title_lower_idx
  on public.editor_logo_catalog ((lower(title)));

create index if not exists editor_logo_catalog_search_text_idx
  on public.editor_logo_catalog ((lower(search_text)));

alter table public.editor_logo_catalog enable row level security;

-- Conservative: allow SELECT only for editor allowlisted users.
create policy "editor_logo_catalog_select_editor_users"
  on public.editor_logo_catalog
  for select
  using (exists (select 1 from public.editor_users eu where eu.user_id = auth.uid()));

