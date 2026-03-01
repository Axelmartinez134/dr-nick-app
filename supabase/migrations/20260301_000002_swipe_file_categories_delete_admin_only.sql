-- Swipe File: restrict category deletes to admins/owners only
-- Users can delete Swipe File *items* as account members, but deleting *categories*
-- should be limited (items-only deletion for members).

alter table public.swipe_file_categories enable row level security;

drop policy if exists "swipe_file_categories_delete_member" on public.swipe_file_categories;
drop policy if exists "swipe_file_categories_delete_admin" on public.swipe_file_categories;

create policy "swipe_file_categories_delete_admin"
  on public.swipe_file_categories
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
    or exists (select 1 from public.editor_accounts a where a.id = account_id and a.created_by_user_id = auth.uid())
  );

