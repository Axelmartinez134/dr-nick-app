-- Caption Regenerate (per-user prompt + per-project history)

-- Per-user prompt override (global)
alter table public.editor_users
add column if not exists caption_regen_prompt_override text;

-- Per-project caption regeneration history
create table if not exists public.carousel_caption_regen_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.carousel_projects(id) on delete cascade,
  prompt_rendered text not null,
  input_context jsonb not null default '{}'::jsonb,
  output_caption text not null,
  created_at timestamptz not null default now()
);

create index if not exists carousel_caption_regen_runs_owner_project_created_idx
  on public.carousel_caption_regen_runs (owner_user_id, project_id, created_at desc);

alter table public.carousel_caption_regen_runs enable row level security;

-- RLS: users can read their own runs
create policy "caption_regen_runs_select_own"
  on public.carousel_caption_regen_runs
  for select
  using (auth.uid() = owner_user_id);

-- RLS: users can insert their own runs
create policy "caption_regen_runs_insert_own"
  on public.carousel_caption_regen_runs
  for insert
  with check (auth.uid() = owner_user_id);

