-- Generic account-level prompt override storage for editor features.
-- Initial use: Carousel Map stage prompts.

create table if not exists public.editor_account_prompt_overrides (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  surface text not null,
  prompt_key text not null,
  prompt_text text not null default '',
  created_by_user_id uuid null references auth.users(id) on delete set null,
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  constraint editor_account_prompt_overrides_surface_check
    check (surface in ('carousel_map')),
  constraint editor_account_prompt_overrides_prompt_key_check
    check (prompt_key in ('topics', 'opening_pairs', 'expansions'))
);

create unique index if not exists editor_account_prompt_overrides_account_surface_key_uidx
  on public.editor_account_prompt_overrides (account_id, surface, prompt_key);

create index if not exists editor_account_prompt_overrides_account_idx
  on public.editor_account_prompt_overrides (account_id, surface);

alter table public.editor_account_prompt_overrides enable row level security;

drop policy if exists "editor_account_prompt_overrides_select_superadmin" on public.editor_account_prompt_overrides;
create policy "editor_account_prompt_overrides_select_superadmin"
  on public.editor_account_prompt_overrides
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_account_prompt_overrides_insert_superadmin" on public.editor_account_prompt_overrides;
create policy "editor_account_prompt_overrides_insert_superadmin"
  on public.editor_account_prompt_overrides
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_account_prompt_overrides_update_superadmin" on public.editor_account_prompt_overrides;
create policy "editor_account_prompt_overrides_update_superadmin"
  on public.editor_account_prompt_overrides
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_account_prompt_overrides_delete_superadmin" on public.editor_account_prompt_overrides;
create policy "editor_account_prompt_overrides_delete_superadmin"
  on public.editor_account_prompt_overrides
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.editor_account_prompt_overrides to authenticated;

create or replace function public.touch_editor_account_prompt_overrides_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_touch_editor_account_prompt_overrides_updated_at on public.editor_account_prompt_overrides;
create trigger trigger_touch_editor_account_prompt_overrides_updated_at
  before update on public.editor_account_prompt_overrides
  for each row
  execute function public.touch_editor_account_prompt_overrides_updated_at();
