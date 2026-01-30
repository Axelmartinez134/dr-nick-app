-- Phase G — Migrate recents, ideas, caption regen history to account scope
-- - Adds account-scoped uniqueness (where applicable)
-- - Updates RLS policies to membership-based access (owner/admin write; members read)
-- - Keeps a backwards-safe fallback for legacy rows with account_id IS NULL (owner_user_id)

-- -----------------------------
-- Dedupe + account-scoped unique indexes
-- -----------------------------

-- editor_recent_assets: dedupe within account before adding unique indexes
do $$
begin
  if to_regclass('public.editor_recent_assets') is not null then
    -- 1) Dedupe by storage location (best) within account
    execute $sql$
      delete from public.editor_recent_assets r
      using (
        select id,
               row_number() over (
                 partition by account_id, storage_bucket, storage_path
                 order by last_used_at desc, created_at desc, id asc
               ) as rn
        from public.editor_recent_assets
        where account_id is not null
          and storage_bucket is not null
          and storage_path is not null
      ) d
      where r.id = d.id
        and d.rn > 1
    $sql$;

    -- 2) Dedupe by URL within account (fallback)
    execute $sql$
      delete from public.editor_recent_assets r
      using (
        select id,
               row_number() over (
                 partition by account_id, url
                 order by last_used_at desc, created_at desc, id asc
               ) as rn
        from public.editor_recent_assets
        where account_id is not null
      ) d
      where r.id = d.id
        and d.rn > 1
    $sql$;

    -- Add account-scoped uniqueness (partial: only for account_id IS NOT NULL)
    execute $sql$
      create unique index if not exists editor_recent_assets_account_storage_unique
        on public.editor_recent_assets (account_id, storage_bucket, storage_path)
        where account_id is not null
    $sql$;

    execute $sql$
      create unique index if not exists editor_recent_assets_account_url_unique
        on public.editor_recent_assets (account_id, url)
        where account_id is not null
    $sql$;
  end if;
end
$$;

-- editor_idea_sources: dedupe within account before adding unique index
do $$
begin
  if to_regclass('public.editor_idea_sources') is not null then
    execute $sql$
      delete from public.editor_idea_sources s
      using (
        select id,
               row_number() over (
                 partition by account_id, source_title, source_url
                 order by updated_at desc, created_at desc, id asc
               ) as rn
        from public.editor_idea_sources
        where account_id is not null
      ) d
      where s.id = d.id
        and d.rn > 1
    $sql$;

    execute $sql$
      create unique index if not exists editor_idea_sources_account_title_url_unique
        on public.editor_idea_sources (account_id, source_title, source_url)
        where account_id is not null
    $sql$;
  end if;
end
$$;

-- -----------------------------
-- Backfill: caption regen runs can always inherit project.account_id
-- -----------------------------
do $$
begin
  if to_regclass('public.carousel_caption_regen_runs') is not null
     and to_regclass('public.carousel_projects') is not null then
    execute $sql$
      update public.carousel_caption_regen_runs r
      set account_id = p.account_id
      from public.carousel_projects p
      where r.account_id is null
        and r.project_id = p.id
        and p.account_id is not null
    $sql$;
  end if;
end
$$;

-- -----------------------------
-- RLS: account-member access
-- -----------------------------

-- Helper: These policies intentionally keep a legacy fallback for rows with account_id IS NULL
-- so older environments/data still work (owner_user_id = auth.uid()).

-- editor_recent_assets
alter table if exists public.editor_recent_assets enable row level security;
drop policy if exists "editor_recent_assets_select_own" on public.editor_recent_assets;
drop policy if exists "editor_recent_assets_insert_own" on public.editor_recent_assets;
drop policy if exists "editor_recent_assets_update_own" on public.editor_recent_assets;

create policy "editor_recent_assets_select_member"
  on public.editor_recent_assets
  for select
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_recent_assets.account_id
        and m.user_id = auth.uid()
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_recent_assets_insert_admin_owner"
  on public.editor_recent_assets
  for insert
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_recent_assets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_recent_assets_update_admin_owner"
  on public.editor_recent_assets
  for update
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_recent_assets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  )
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_recent_assets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_recent_assets_delete_admin_owner"
  on public.editor_recent_assets
  for delete
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_recent_assets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

-- editor_idea_sources
alter table if exists public.editor_idea_sources enable row level security;
drop policy if exists "editor_idea_sources_select_own" on public.editor_idea_sources;
drop policy if exists "editor_idea_sources_insert_own" on public.editor_idea_sources;
drop policy if exists "editor_idea_sources_update_own" on public.editor_idea_sources;
drop policy if exists "editor_idea_sources_delete_own" on public.editor_idea_sources;

create policy "editor_idea_sources_select_member"
  on public.editor_idea_sources
  for select
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_sources.account_id
        and m.user_id = auth.uid()
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_sources_insert_admin_owner"
  on public.editor_idea_sources
  for insert
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_sources.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_sources_update_admin_owner"
  on public.editor_idea_sources
  for update
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_sources.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  )
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_sources.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_sources_delete_admin_owner"
  on public.editor_idea_sources
  for delete
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_sources.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

-- editor_idea_runs
alter table if exists public.editor_idea_runs enable row level security;
drop policy if exists "editor_idea_runs_select_own" on public.editor_idea_runs;
drop policy if exists "editor_idea_runs_insert_own" on public.editor_idea_runs;
drop policy if exists "editor_idea_runs_update_own" on public.editor_idea_runs;
drop policy if exists "editor_idea_runs_delete_own" on public.editor_idea_runs;

create policy "editor_idea_runs_select_member"
  on public.editor_idea_runs
  for select
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_runs.account_id
        and m.user_id = auth.uid()
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_runs_insert_admin_owner"
  on public.editor_idea_runs
  for insert
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_runs_update_admin_owner"
  on public.editor_idea_runs
  for update
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  )
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_runs_delete_admin_owner"
  on public.editor_idea_runs
  for delete
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

-- editor_ideas
alter table if exists public.editor_ideas enable row level security;
drop policy if exists "editor_ideas_select_own" on public.editor_ideas;
drop policy if exists "editor_ideas_insert_own" on public.editor_ideas;
drop policy if exists "editor_ideas_update_own" on public.editor_ideas;
drop policy if exists "editor_ideas_delete_own" on public.editor_ideas;

create policy "editor_ideas_select_member"
  on public.editor_ideas
  for select
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_ideas.account_id
        and m.user_id = auth.uid()
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_ideas_insert_admin_owner"
  on public.editor_ideas
  for insert
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_ideas.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_ideas_update_admin_owner"
  on public.editor_ideas
  for update
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_ideas.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  )
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_ideas.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_ideas_delete_admin_owner"
  on public.editor_ideas
  for delete
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_ideas.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

-- editor_idea_carousel_runs
alter table if exists public.editor_idea_carousel_runs enable row level security;
drop policy if exists "editor_idea_carousel_runs_select_own" on public.editor_idea_carousel_runs;
drop policy if exists "editor_idea_carousel_runs_insert_own" on public.editor_idea_carousel_runs;

create policy "editor_idea_carousel_runs_select_member"
  on public.editor_idea_carousel_runs
  for select
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_carousel_runs.account_id
        and m.user_id = auth.uid()
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "editor_idea_carousel_runs_insert_admin_owner"
  on public.editor_idea_carousel_runs
  for insert
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = editor_idea_carousel_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

-- carousel_caption_regen_runs
alter table if exists public.carousel_caption_regen_runs enable row level security;
drop policy if exists "caption_regen_runs_select_own" on public.carousel_caption_regen_runs;
drop policy if exists "caption_regen_runs_insert_own" on public.carousel_caption_regen_runs;

create policy "caption_regen_runs_select_member"
  on public.carousel_caption_regen_runs
  for select
  using (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_caption_regen_runs.account_id
        and m.user_id = auth.uid()
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

create policy "caption_regen_runs_insert_admin_owner"
  on public.carousel_caption_regen_runs
  for insert
  with check (
    (account_id is not null and exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_caption_regen_runs.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
    or (account_id is null and owner_user_id = auth.uid())
  );

