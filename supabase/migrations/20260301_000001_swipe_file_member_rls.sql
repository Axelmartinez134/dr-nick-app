-- Swipe File: allow account members (not just superadmins)
-- This migration expands RLS on swipe_file_categories + swipe_file_items so any authenticated
-- user who is an owner/member of the relevant editor_account can use Swipe File.

-- =========================
-- Helpers (inline predicates)
-- =========================
-- We intentionally inline checks in policies (no SQL functions) to keep migrations simple.

-- =========================
-- Categories
-- =========================
alter table public.swipe_file_categories enable row level security;

drop policy if exists "swipe_file_categories_select_superadmin" on public.swipe_file_categories;
drop policy if exists "swipe_file_categories_insert_superadmin" on public.swipe_file_categories;
drop policy if exists "swipe_file_categories_update_superadmin" on public.swipe_file_categories;
drop policy if exists "swipe_file_categories_delete_superadmin" on public.swipe_file_categories;

drop policy if exists "swipe_file_categories_select_member" on public.swipe_file_categories;
create policy "swipe_file_categories_select_member"
  on public.swipe_file_categories
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

drop policy if exists "swipe_file_categories_insert_member" on public.swipe_file_categories;
create policy "swipe_file_categories_insert_member"
  on public.swipe_file_categories
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

drop policy if exists "swipe_file_categories_update_member" on public.swipe_file_categories;
create policy "swipe_file_categories_update_member"
  on public.swipe_file_categories
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

drop policy if exists "swipe_file_categories_delete_member" on public.swipe_file_categories;
create policy "swipe_file_categories_delete_member"
  on public.swipe_file_categories
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

grant all on public.swipe_file_categories to authenticated;

-- =========================
-- Items
-- =========================
alter table public.swipe_file_items enable row level security;

drop policy if exists "swipe_file_items_select_superadmin" on public.swipe_file_items;
drop policy if exists "swipe_file_items_insert_superadmin" on public.swipe_file_items;
drop policy if exists "swipe_file_items_update_superadmin" on public.swipe_file_items;
drop policy if exists "swipe_file_items_delete_superadmin" on public.swipe_file_items;

drop policy if exists "swipe_file_items_select_member" on public.swipe_file_items;
create policy "swipe_file_items_select_member"
  on public.swipe_file_items
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

drop policy if exists "swipe_file_items_insert_member" on public.swipe_file_items;
create policy "swipe_file_items_insert_member"
  on public.swipe_file_items
  for insert
  with check (
    created_by_user_id = auth.uid()
    and (
      exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
      or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
      or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
    )
  );

drop policy if exists "swipe_file_items_update_member" on public.swipe_file_items;
create policy "swipe_file_items_update_member"
  on public.swipe_file_items
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

drop policy if exists "swipe_file_items_delete_member" on public.swipe_file_items;
create policy "swipe_file_items_delete_member"
  on public.swipe_file_items
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
    or exists (select 1 from public.editor_account_memberships m where m.account_id = account_id and m.user_id = auth.uid())
  );

grant all on public.swipe_file_items to authenticated;

