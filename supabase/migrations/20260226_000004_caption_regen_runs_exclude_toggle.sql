-- Caption Regenerate: allow excluding prior runs from future prompt context
-- Adds a superadmin-only toggle that prevents specific past captions from being sent to the model again.

alter table if exists public.carousel_caption_regen_runs
  add column if not exists excluded_from_prompt boolean not null default false,
  add column if not exists excluded_at timestamptz null,
  add column if not exists excluded_by_user_id uuid null references auth.users(id) on delete set null;

create index if not exists carousel_caption_regen_runs_account_project_excluded_idx
  on public.carousel_caption_regen_runs (account_id, project_id, excluded_from_prompt, created_at desc);

-- RLS: superadmin-only UPDATE (toggle exclude/include)
alter table if exists public.carousel_caption_regen_runs enable row level security;

drop policy if exists "caption_regen_runs_update_superadmin" on public.carousel_caption_regen_runs;
create policy "caption_regen_runs_update_superadmin"
  on public.carousel_caption_regen_runs
  for update
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

