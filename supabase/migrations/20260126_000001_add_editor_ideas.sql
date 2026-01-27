-- Editor: Ideas (Phase 0)
-- Stores user-scoped sources, idea generation runs, and extracted topic ideas.
-- Designed to support:
-- - Manual Source Title + URL grouping
-- - Persisted approve/dismiss + ordered "approved queue"
-- - Auditability via prompt_rendered + poppy routing meta

-- Per-editor-user Ideas prompt override (global per user)
ALTER TABLE public.editor_users
  ADD COLUMN IF NOT EXISTS ideas_prompt_override TEXT;

-- Sources (grouping key: owner + title + url)
create table if not exists public.editor_idea_sources (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_title text not null,
  source_url text not null,
  last_generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists editor_idea_sources_owner_title_url_unique
  on public.editor_idea_sources (owner_user_id, source_title, source_url);

create index if not exists editor_idea_sources_owner_last_generated_idx
  on public.editor_idea_sources (owner_user_id, last_generated_at desc, created_at desc);

alter table public.editor_idea_sources enable row level security;

create policy "editor_idea_sources_select_own"
  on public.editor_idea_sources
  for select
  using (owner_user_id = auth.uid());

create policy "editor_idea_sources_insert_own"
  on public.editor_idea_sources
  for insert
  with check (owner_user_id = auth.uid());

create policy "editor_idea_sources_update_own"
  on public.editor_idea_sources
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Runs (one per "Generate Ideas" click)
create table if not exists public.editor_idea_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.editor_idea_sources(id) on delete cascade,
  status text not null default 'running', -- running | completed | failed
  error text null,
  prompt_rendered text not null default '',
  poppy_routing_meta jsonb null, -- { boardId, chatId, model }
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);

create index if not exists editor_idea_runs_owner_created_idx
  on public.editor_idea_runs (owner_user_id, created_at desc);

create index if not exists editor_idea_runs_source_created_idx
  on public.editor_idea_runs (source_id, created_at desc);

alter table public.editor_idea_runs enable row level security;

create policy "editor_idea_runs_select_own"
  on public.editor_idea_runs
  for select
  using (owner_user_id = auth.uid());

create policy "editor_idea_runs_insert_own"
  on public.editor_idea_runs
  for insert
  with check (owner_user_id = auth.uid());

create policy "editor_idea_runs_update_own"
  on public.editor_idea_runs
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Ideas (topics)
create table if not exists public.editor_ideas (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.editor_idea_sources(id) on delete cascade,
  run_id uuid not null references public.editor_idea_runs(id) on delete cascade,
  title text not null,
  bullets jsonb not null default '[]'::jsonb, -- [{ heading: string, points: string[] }]
  status text not null default 'pending', -- pending | approved | dismissed
  approved_sort_index integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editor_ideas_owner_source_created_idx
  on public.editor_ideas (owner_user_id, source_id, created_at desc);

create index if not exists editor_ideas_owner_status_created_idx
  on public.editor_ideas (owner_user_id, status, created_at desc);

create index if not exists editor_ideas_owner_approved_sort_idx
  on public.editor_ideas (owner_user_id, approved_sort_index asc)
  where status = 'approved' and approved_sort_index is not null;

alter table public.editor_ideas enable row level security;

create policy "editor_ideas_select_own"
  on public.editor_ideas
  for select
  using (owner_user_id = auth.uid());

create policy "editor_ideas_insert_own"
  on public.editor_ideas
  for insert
  with check (owner_user_id = auth.uid());

create policy "editor_ideas_update_own"
  on public.editor_ideas
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

