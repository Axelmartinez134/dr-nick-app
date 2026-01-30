-- Editor: Multi-tenant Accounts (Phase D)
-- Enable account-scoped access for the core project surface area:
-- - carousel_projects (project rows)
-- - carousel_project_slides (slides for a project)
-- - carousel_generation_jobs (job status/polling)
--
-- IMPORTANT:
-- - We do NOT remove legacy owner-only policies here; we add account-member policies.
-- - We include a backwards-safe fallback for legacy rows with account_id IS NULL
--   so existing data continues to work while any straggler rows are backfilled.

-- =========================
-- 1) carousel_projects
-- =========================
alter table public.carousel_projects enable row level security;

drop policy if exists "carousel_projects_select_account_member" on public.carousel_projects;
create policy "carousel_projects_select_account_member"
  on public.carousel_projects
  for select
  using (
    (account_id is not null and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_projects.account_id
        and m.user_id = auth.uid()
    ))
    or
    (account_id is null and owner_user_id = auth.uid())
  );

drop policy if exists "carousel_projects_insert_account_admin_owner" on public.carousel_projects;
create policy "carousel_projects_insert_account_admin_owner"
  on public.carousel_projects
  for insert
  with check (
    (account_id is not null and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_projects.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or
    (account_id is null and owner_user_id = auth.uid())
  );

drop policy if exists "carousel_projects_update_account_admin_owner" on public.carousel_projects;
create policy "carousel_projects_update_account_admin_owner"
  on public.carousel_projects
  for update
  using (
    (account_id is not null and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_projects.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or
    (account_id is null and owner_user_id = auth.uid())
  )
  with check (
    (account_id is not null and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_projects.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or
    (account_id is null and owner_user_id = auth.uid())
  );

drop policy if exists "carousel_projects_delete_account_admin_owner" on public.carousel_projects;
create policy "carousel_projects_delete_account_admin_owner"
  on public.carousel_projects
  for delete
  using (
    (account_id is not null and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.carousel_projects.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or
    (account_id is null and owner_user_id = auth.uid())
  );

-- =========================
-- 2) carousel_project_slides
-- =========================
alter table public.carousel_project_slides enable row level security;

drop policy if exists "carousel_project_slides_select_account_member" on public.carousel_project_slides;
create policy "carousel_project_slides_select_account_member"
  on public.carousel_project_slides
  for select
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "carousel_project_slides_insert_account_admin_owner" on public.carousel_project_slides;
create policy "carousel_project_slides_insert_account_admin_owner"
  on public.carousel_project_slides
  for insert
  with check (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "carousel_project_slides_update_account_admin_owner" on public.carousel_project_slides;
create policy "carousel_project_slides_update_account_admin_owner"
  on public.carousel_project_slides
  for update
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "carousel_project_slides_delete_account_admin_owner" on public.carousel_project_slides;
create policy "carousel_project_slides_delete_account_admin_owner"
  on public.carousel_project_slides
  for delete
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

-- =========================
-- 3) carousel_generation_jobs
-- =========================
alter table public.carousel_generation_jobs enable row level security;

drop policy if exists "carousel_generation_jobs_select_account_member" on public.carousel_generation_jobs;
create policy "carousel_generation_jobs_select_account_member"
  on public.carousel_generation_jobs
  for select
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_generation_jobs.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "carousel_generation_jobs_insert_account_admin_owner" on public.carousel_generation_jobs;
create policy "carousel_generation_jobs_insert_account_admin_owner"
  on public.carousel_generation_jobs
  for insert
  with check (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_generation_jobs.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "carousel_generation_jobs_update_account_admin_owner" on public.carousel_generation_jobs;
create policy "carousel_generation_jobs_update_account_admin_owner"
  on public.carousel_generation_jobs
  for update
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_generation_jobs.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.carousel_generation_jobs.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

