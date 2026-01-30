-- Editor: Multi-tenant Accounts (Phase E)
-- Allow account owners/admins to upsert account-scoped editor settings via authed API routes.
--
-- Adds:
-- - INSERT policy for editor_account_settings (owner/admin)
-- - updated_at trigger for editor_account_settings

-- =========================
-- 1) INSERT policy (owner/admin)
-- =========================
alter table public.editor_account_settings enable row level security;

drop policy if exists "editor_account_settings_insert_admin_owner" on public.editor_account_settings;
create policy "editor_account_settings_insert_admin_owner"
  on public.editor_account_settings
  for insert
  with check (
    exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.editor_account_settings.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- =========================
-- 2) Auto-update updated_at
-- =========================
create or replace function public.update_editor_account_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_editor_account_settings_updated_at on public.editor_account_settings;
create trigger trigger_update_editor_account_settings_updated_at
  before update on public.editor_account_settings
  for each row
  execute function public.update_editor_account_settings_updated_at();

