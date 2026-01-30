-- Editor: Multi-tenant Accounts (Phase B)
-- Add nullable account_id columns to editor-owned tables (no behavior change yet).
-- Backfill existing rows to each user's Personal account (created_by_user_id linkage from Phase A).

-- =========================
-- 0) Superadmins table (foundation for later phases)
-- =========================
-- Used later to show the account switcher + authorize cross-account admin operations.
create table if not exists public.editor_superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.editor_superadmins enable row level security;

-- Superadmins can read their own row (optional convenience).
drop policy if exists "editor_superadmins_select_self" on public.editor_superadmins;
create policy "editor_superadmins_select_self"
  on public.editor_superadmins
  for select
  using (auth.uid() = user_id);

grant all on public.editor_superadmins to authenticated;

-- Seed Ax as superadmin if the auth user exists (safe + idempotent).
insert into public.editor_superadmins (user_id)
select id
from auth.users
where lower(email) = lower('axel@measurezpro.com')
on conflict (user_id) do nothing;

-- =========================
-- 1) Add account_id columns (nullable)
-- =========================

alter table if exists public.carousel_projects
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.carousel_templates
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.carousel_template_type_overrides
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.editor_recent_assets
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.editor_idea_sources
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.editor_idea_runs
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.editor_ideas
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.editor_idea_carousel_runs
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

alter table if exists public.carousel_caption_regen_runs
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

-- Optional but useful later: jobs are logically account-scoped via project_id.
alter table if exists public.carousel_generation_jobs
  add column if not exists account_id uuid references public.editor_accounts(id) on delete set null;

-- =========================
-- 2) Indexes for future account-scoped queries
-- =========================

create index if not exists carousel_projects_account_updated_idx
  on public.carousel_projects (account_id, updated_at desc);

create index if not exists carousel_templates_account_updated_idx
  on public.carousel_templates (account_id, updated_at desc);

create index if not exists editor_recent_assets_account_last_used_idx
  on public.editor_recent_assets (account_id, last_used_at desc);

create index if not exists editor_idea_sources_account_last_generated_idx
  on public.editor_idea_sources (account_id, last_generated_at desc, created_at desc);

create index if not exists editor_idea_runs_account_created_idx
  on public.editor_idea_runs (account_id, created_at desc);

create index if not exists editor_ideas_account_status_created_idx
  on public.editor_ideas (account_id, status, created_at desc);

create index if not exists carousel_caption_regen_runs_account_project_created_idx
  on public.carousel_caption_regen_runs (account_id, project_id, created_at desc);

create index if not exists carousel_generation_jobs_account_started_idx
  on public.carousel_generation_jobs (account_id, started_at desc);

-- =========================
-- 3) Backfill account_id for existing rows (safe + idempotent)
-- =========================
-- Strategy:
-- - For "owner_user_id" tables, map owner_user_id -> editor_accounts.id where editor_accounts.created_by_user_id = owner_user_id
-- - For template_type_overrides, map user_id -> editor_accounts.id where created_by_user_id = user_id
-- - For jobs, map via project.account_id after projects are backfilled

do $$
begin
  if to_regclass('public.carousel_projects') is not null then
    execute $sql$
      update public.carousel_projects p
      set account_id = a.id
      from public.editor_accounts a
      where p.account_id is null
        and a.created_by_user_id = p.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.carousel_templates') is not null then
    execute $sql$
      update public.carousel_templates t
      set account_id = a.id
      from public.editor_accounts a
      where t.account_id is null
        and a.created_by_user_id = t.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.carousel_template_type_overrides') is not null then
    execute $sql$
      update public.carousel_template_type_overrides o
      set account_id = a.id
      from public.editor_accounts a
      where o.account_id is null
        and a.created_by_user_id = o.user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.editor_recent_assets') is not null then
    execute $sql$
      update public.editor_recent_assets r
      set account_id = a.id
      from public.editor_accounts a
      where r.account_id is null
        and a.created_by_user_id = r.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.editor_idea_sources') is not null then
    execute $sql$
      update public.editor_idea_sources s
      set account_id = a.id
      from public.editor_accounts a
      where s.account_id is null
        and a.created_by_user_id = s.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.editor_idea_runs') is not null then
    execute $sql$
      update public.editor_idea_runs r
      set account_id = a.id
      from public.editor_accounts a
      where r.account_id is null
        and a.created_by_user_id = r.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.editor_ideas') is not null then
    execute $sql$
      update public.editor_ideas i
      set account_id = a.id
      from public.editor_accounts a
      where i.account_id is null
        and a.created_by_user_id = i.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.editor_idea_carousel_runs') is not null then
    execute $sql$
      update public.editor_idea_carousel_runs r
      set account_id = a.id
      from public.editor_accounts a
      where r.account_id is null
        and a.created_by_user_id = r.owner_user_id
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.carousel_caption_regen_runs') is not null then
    execute $sql$
      update public.carousel_caption_regen_runs r
      set account_id = a.id
      from public.editor_accounts a
      where r.account_id is null
        and a.created_by_user_id = r.owner_user_id
    $sql$;
  end if;
end
$$;

-- Backfill jobs via project.account_id (after projects are mapped).
do $$
begin
  if to_regclass('public.carousel_generation_jobs') is not null and to_regclass('public.carousel_projects') is not null then
    execute $sql$
      update public.carousel_generation_jobs j
      set account_id = p.account_id
      from public.carousel_projects p
      where j.account_id is null
        and p.id = j.project_id
        and p.account_id is not null
    $sql$;
  end if;
end
$$;

