-- Editor: Multi-tenant Accounts (Phase A)
--
-- Adds account-level workspaces for /editor without changing existing behavior yet.
-- Phase A is DB foundations + safe backfill:
-- - editor_accounts: workspace objects (client accounts + personal account)
-- - editor_account_memberships: which users can access which accounts + role (owner/admin/member)
-- - editor_account_settings: account-scoped settings (poppy URL, image gen model, ideas prompt, caption regen prompt)
--
-- Notes:
-- - No client-side writes yet; manual onboarding via Supabase Dashboard.
-- - Existing per-user settings remain the source of truth until later phases migrate routes.

-- =========================
-- 0) Tables
-- =========================

create table if not exists public.editor_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.editor_account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now()
);

create unique index if not exists editor_account_memberships_account_user_unique
  on public.editor_account_memberships (account_id, user_id);

create index if not exists editor_account_memberships_user_idx
  on public.editor_account_memberships (user_id);

create table if not exists public.editor_account_settings (
  account_id uuid primary key references public.editor_accounts(id) on delete cascade,
  poppy_conversation_url text null,
  ai_image_gen_model text not null default 'gpt-image-1.5',
  ideas_prompt_override text null,
  caption_regen_prompt_override text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 1) RLS + Policies
-- =========================

alter table public.editor_accounts enable row level security;
alter table public.editor_account_memberships enable row level security;
alter table public.editor_account_settings enable row level security;

-- Accounts: members can read accounts they belong to.
drop policy if exists "editor_accounts_select_member" on public.editor_accounts;
create policy "editor_accounts_select_member"
  on public.editor_accounts
  for select
  using (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_accounts.id
        and m.user_id = auth.uid()
    )
  );

-- Memberships: users can read their own memberships (used to build account switcher UI).
drop policy if exists "editor_account_memberships_select_self" on public.editor_account_memberships;
create policy "editor_account_memberships_select_self"
  on public.editor_account_memberships
  for select
  using (auth.uid() = user_id);

-- Settings: members can read settings for accounts they belong to.
drop policy if exists "editor_account_settings_select_member" on public.editor_account_settings;
create policy "editor_account_settings_select_member"
  on public.editor_account_settings
  for select
  using (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_account_settings.account_id
        and m.user_id = auth.uid()
    )
  );

-- Settings: allow admin/owner to update (future phases will write here).
drop policy if exists "editor_account_settings_update_admin_owner" on public.editor_account_settings;
create policy "editor_account_settings_update_admin_owner"
  on public.editor_account_settings
  for update
  using (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_account_settings.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_account_settings.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- No INSERT/DELETE policies in Phase A; manage via Supabase Dashboard / SQL editor or service role.

grant all on public.editor_accounts to authenticated;
grant all on public.editor_account_memberships to authenticated;
grant all on public.editor_account_settings to authenticated;

-- =========================
-- 2) Backfill: create Personal account for each existing editor_user
-- =========================
-- This is intentionally safe/idempotent:
-- - Only creates accounts for editor_users that currently have zero memberships.
-- - Copies the existing per-user settings into account settings, so later migration can be lossless.

with needs as (
  select
    eu.user_id,
    eu.first_name,
    eu.last_name,
    eu.poppy_conversation_url,
    eu.ai_image_gen_model,
    eu.ideas_prompt_override,
    eu.caption_regen_prompt_override
  from public.editor_users eu
  left join public.editor_account_memberships m
    on m.user_id = eu.user_id
  where m.user_id is null
),
ins_accounts as (
  insert into public.editor_accounts (display_name, created_by_user_id)
  select
    case
      when coalesce(nullif(trim(needs.first_name), ''), '') <> '' then trim(needs.first_name) || ' (Personal)'
      else 'Personal'
    end as display_name,
    needs.user_id
  from needs
  returning id, created_by_user_id
),
ins_memberships as (
  insert into public.editor_account_memberships (account_id, user_id, role)
  select id, created_by_user_id, 'owner'
  from ins_accounts
  returning account_id, user_id
)
insert into public.editor_account_settings (
  account_id,
  poppy_conversation_url,
  ai_image_gen_model,
  ideas_prompt_override,
  caption_regen_prompt_override
)
select
  a.id,
  eu.poppy_conversation_url,
  coalesce(nullif(trim(eu.ai_image_gen_model), ''), 'gpt-image-1.5'),
  eu.ideas_prompt_override,
  eu.caption_regen_prompt_override
from ins_accounts a
join public.editor_users eu
  on eu.user_id = a.created_by_user_id
on conflict (account_id) do nothing;

