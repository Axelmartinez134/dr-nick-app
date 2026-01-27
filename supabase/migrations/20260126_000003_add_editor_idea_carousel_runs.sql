-- Editor: Idea → Carousel run audit (Phase 4)
-- Records the injected prompt and routing meta used when creating a carousel project from an idea.

create table if not exists public.editor_idea_carousel_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid not null references public.editor_ideas(id) on delete cascade,
  source_id uuid not null references public.editor_idea_sources(id) on delete cascade,
  project_id uuid not null references public.carousel_projects(id) on delete cascade,
  template_type_id text not null,
  prompt_rendered text not null default '',
  poppy_routing_meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists editor_idea_carousel_runs_owner_created_idx
  on public.editor_idea_carousel_runs (owner_user_id, created_at desc);

create index if not exists editor_idea_carousel_runs_owner_idea_idx
  on public.editor_idea_carousel_runs (owner_user_id, idea_id);

alter table public.editor_idea_carousel_runs enable row level security;

create policy "editor_idea_carousel_runs_select_own"
  on public.editor_idea_carousel_runs
  for select
  using (owner_user_id = auth.uid());

create policy "editor_idea_carousel_runs_insert_own"
  on public.editor_idea_carousel_runs
  for insert
  with check (owner_user_id = auth.uid());

