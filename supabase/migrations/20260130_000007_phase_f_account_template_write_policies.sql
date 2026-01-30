-- Editor: Multi-tenant Accounts (Phase F)
-- Allow account admin/owner to create/update/delete templates inside their account.
--
-- We keep existing owner-only behavior as fallback, and add account-based write policies.
-- This is required so Ax (admin) can manage templates in a client account.

alter table public.carousel_templates enable row level security;

drop policy if exists "carousel_templates_insert_account_admin_owner" on public.carousel_templates;
create policy "carousel_templates_insert_account_admin_owner"
  on public.carousel_templates
  for insert
  with check (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_templates.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

drop policy if exists "carousel_templates_update_account_admin_owner" on public.carousel_templates;
create policy "carousel_templates_update_account_admin_owner"
  on public.carousel_templates
  for update
  using (
    (
      account_id is not null
      and exists (
        select 1
        from public.editor_account_memberships m
        where m.account_id = public.carousel_templates.account_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    )
    or
    (account_id is null and owner_user_id = auth.uid())
  )
  with check (
    (
      account_id is not null
      and exists (
        select 1
        from public.editor_account_memberships m
        where m.account_id = public.carousel_templates.account_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    )
    or
    (account_id is null and owner_user_id = auth.uid())
  );

drop policy if exists "carousel_templates_delete_account_admin_owner" on public.carousel_templates;
create policy "carousel_templates_delete_account_admin_owner"
  on public.carousel_templates
  for delete
  using (
    (
      account_id is not null
      and exists (
        select 1
        from public.editor_account_memberships m
        where m.account_id = public.carousel_templates.account_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
    )
    or
    (account_id is null and owner_user_id = auth.uid())
  );

