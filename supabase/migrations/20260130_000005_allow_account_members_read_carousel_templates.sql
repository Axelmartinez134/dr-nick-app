-- Editor: Account-scoped template READ (Hotfix for account switching)
--
-- Without this, when Ax switches into a client account, projects load but template definitions
-- cannot be read (templates were previously owner-private only), causing "Loading template…"
-- to hang in the UI.
--
-- This keeps the existing owner-only semantics, and *adds* account-member read access.

alter table public.carousel_templates enable row level security;

drop policy if exists "Carousel templates: read account member" on public.carousel_templates;
create policy "Carousel templates: read account member"
  on public.carousel_templates
  for select
  to public
  using (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_templates.account_id
        and m.user_id = auth.uid()
    )
  );

