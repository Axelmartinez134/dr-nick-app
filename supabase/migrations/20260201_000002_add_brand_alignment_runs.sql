-- Editor: Brand Alignment (Phase 2)
-- Persist each brand alignment check as a run history row (account-scoped).

create table if not exists public.carousel_brand_alignment_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.carousel_projects(id) on delete cascade,
  system_prompt text not null,
  user_message text not null,
  output_json jsonb not null,
  overall_score int not null,
  verdict text not null check (verdict in ('aligned','needs_edits','off_brand')),
  model text null,
  created_at timestamptz not null default now()
);

create index if not exists carousel_brand_alignment_runs_account_project_created_idx
  on public.carousel_brand_alignment_runs (account_id, project_id, created_at desc);

alter table public.carousel_brand_alignment_runs enable row level security;

drop policy if exists "brand_alignment_runs_select_member" on public.carousel_brand_alignment_runs;
create policy "brand_alignment_runs_select_member"
  on public.carousel_brand_alignment_runs
  for select
  using (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = carousel_brand_alignment_runs.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "brand_alignment_runs_insert_admin_owner" on public.carousel_brand_alignment_runs;
create policy "brand_alignment_runs_insert_admin_owner"
  on public.carousel_brand_alignment_runs
  for insert
  with check (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = carousel_brand_alignment_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

grant all on public.carousel_brand_alignment_runs to authenticated;

