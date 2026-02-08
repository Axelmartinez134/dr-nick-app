-- Editor: Outreach targets (Phase 6)
-- Track scraped Instagram profiles + created template/project ids (mini CRM).

create table if not exists public.editor_outreach_targets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  -- Hybrid metadata (nullable; NOT used for access control)
  account_id uuid null references public.editor_accounts(id) on delete set null,

  instagram_url text not null,
  full_name text null,
  username text null,
  profile_pic_url_hd text null,
  raw_json jsonb null,

  base_template_id uuid null references public.carousel_templates(id) on delete set null,
  created_template_id uuid null references public.carousel_templates(id) on delete set null,
  created_project_id uuid null references public.carousel_projects(id) on delete set null
);

create index if not exists editor_outreach_targets_created_at_idx
  on public.editor_outreach_targets (created_at desc);

create index if not exists editor_outreach_targets_account_created_at_idx
  on public.editor_outreach_targets (account_id, created_at desc);

alter table public.editor_outreach_targets enable row level security;

-- Superadmins-only (Outreach is superadmin-only). Account_id is metadata, so policies do not depend on it.
drop policy if exists "editor_outreach_targets_select_superadmin" on public.editor_outreach_targets;
create policy "editor_outreach_targets_select_superadmin"
  on public.editor_outreach_targets
  for select
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "editor_outreach_targets_insert_superadmin" on public.editor_outreach_targets;
create policy "editor_outreach_targets_insert_superadmin"
  on public.editor_outreach_targets
  for insert
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

grant all on public.editor_outreach_targets to authenticated;

