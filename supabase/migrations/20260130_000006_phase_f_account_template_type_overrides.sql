-- Editor: Multi-tenant Accounts (Phase F)
-- Make template-type overrides account-owned (shared within account).
--
-- Changes:
-- - Backfill account_id for existing rows
-- - Deduplicate to one row per (account_id, template_type_id) (keep newest updated_at)
-- - Add UNIQUE constraint (account_id, template_type_id) so API can upsert onConflict
-- - Add account-membership based RLS (does not rely on is_editor_user())

-- 1) Ensure account_id is populated
update public.carousel_template_type_overrides o
set account_id = a.id
from public.editor_accounts a
where o.account_id is null
  and a.created_by_user_id = o.user_id;

-- 2) Deduplicate within each account/template type (keep newest updated_at)
do $$
begin
  if to_regclass('public.carousel_template_type_overrides') is not null then
    execute $sql$
      delete from public.carousel_template_type_overrides o
      using public.carousel_template_type_overrides o2
      where o.account_id is not null
        and o2.account_id = o.account_id
        and o2.template_type_id = o.template_type_id
        and (
          o2.updated_at > o.updated_at
          or (o2.updated_at = o.updated_at and o2.user_id::text > o.user_id::text)
        )
    $sql$;
  end if;
end
$$;

-- 3) Enforce uniqueness for upsert conflict target
alter table public.carousel_template_type_overrides
  drop constraint if exists carousel_template_type_overrides_account_type_unique;
alter table public.carousel_template_type_overrides
  add constraint carousel_template_type_overrides_account_type_unique unique (account_id, template_type_id);

-- 4) RLS: allow account members to read; allow account admin/owner to write
alter table public.carousel_template_type_overrides enable row level security;

drop policy if exists "Template type overrides: select self only" on public.carousel_template_type_overrides;
drop policy if exists "Template type overrides: insert self only" on public.carousel_template_type_overrides;
drop policy if exists "Template type overrides: update self only" on public.carousel_template_type_overrides;
drop policy if exists "Template type overrides: delete self only" on public.carousel_template_type_overrides;

drop policy if exists "template_type_overrides_select_account_member" on public.carousel_template_type_overrides;
create policy "template_type_overrides_select_account_member"
  on public.carousel_template_type_overrides
  for select
  using (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_template_type_overrides.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "template_type_overrides_insert_account_admin_owner" on public.carousel_template_type_overrides;
create policy "template_type_overrides_insert_account_admin_owner"
  on public.carousel_template_type_overrides
  for insert
  with check (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_template_type_overrides.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

drop policy if exists "template_type_overrides_update_account_admin_owner" on public.carousel_template_type_overrides;
create policy "template_type_overrides_update_account_admin_owner"
  on public.carousel_template_type_overrides
  for update
  using (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_template_type_overrides.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
  with check (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_template_type_overrides.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

