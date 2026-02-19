-- Editor: Saved Poppy Prompts (per-user, per-account, per template type)
-- Purpose:
-- - Allow users to store multiple Poppy prompts and select one "active" prompt
-- - Scoped by (account_id, user_id, template_type_id)
-- - "Active" is enforced as exactly one row per scope (best-effort via unique partial index)
-- - Seeding is idempotent via an optional seed_key unique index

create table if not exists public.editor_poppy_saved_prompts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_type_id text not null references public.carousel_template_types(id) on delete cascade,
  title text not null,
  prompt text not null default '',
  is_active boolean not null default false,
  seed_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ordering/query index: list by template type with active pinned, then updated desc.
create index if not exists editor_poppy_saved_prompts_lookup_idx
  on public.editor_poppy_saved_prompts (account_id, user_id, template_type_id, is_active desc, updated_at desc);

-- Enforce one active prompt per (account_id, user_id, template_type_id).
create unique index if not exists editor_poppy_saved_prompts_one_active_idx
  on public.editor_poppy_saved_prompts (account_id, user_id, template_type_id)
  where is_active;

-- Idempotent seed support (e.g. seed_key='default').
create unique index if not exists editor_poppy_saved_prompts_seed_unique_idx
  on public.editor_poppy_saved_prompts (account_id, user_id, template_type_id, seed_key)
  where seed_key is not null;

-- Auto-update updated_at
create or replace function public.update_editor_poppy_saved_prompts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_editor_poppy_saved_prompts_updated_at on public.editor_poppy_saved_prompts;
create trigger trigger_update_editor_poppy_saved_prompts_updated_at
  before update on public.editor_poppy_saved_prompts
  for each row
  execute function public.update_editor_poppy_saved_prompts_updated_at();

-- RLS: any account member can manage their own private prompts
alter table public.editor_poppy_saved_prompts enable row level security;

drop policy if exists "editor_poppy_saved_prompts_select_self" on public.editor_poppy_saved_prompts;
create policy "editor_poppy_saved_prompts_select_self"
  on public.editor_poppy_saved_prompts
  for select
  using (
    account_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_poppy_saved_prompts.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "editor_poppy_saved_prompts_insert_self" on public.editor_poppy_saved_prompts;
create policy "editor_poppy_saved_prompts_insert_self"
  on public.editor_poppy_saved_prompts
  for insert
  with check (
    account_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_poppy_saved_prompts.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "editor_poppy_saved_prompts_update_self" on public.editor_poppy_saved_prompts;
create policy "editor_poppy_saved_prompts_update_self"
  on public.editor_poppy_saved_prompts
  for update
  using (
    account_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_poppy_saved_prompts.account_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    account_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_poppy_saved_prompts.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "editor_poppy_saved_prompts_delete_self" on public.editor_poppy_saved_prompts;
create policy "editor_poppy_saved_prompts_delete_self"
  on public.editor_poppy_saved_prompts
  for delete
  using (
    account_id is not null
    and user_id = auth.uid()
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_poppy_saved_prompts.account_id
        and m.user_id = auth.uid()
    )
  );

