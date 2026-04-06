-- HTML template type rollout - Phase 3
-- Additive schema only: html preset storage + html slide storage + project metadata.

-- ============================================================
-- 1) html_design_presets
-- Must exist before carousel_projects.html_preset_id FK is added.
-- ============================================================
create table if not exists public.html_design_presets (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.editor_accounts(id) on delete cascade,
  name text not null,
  localized_name jsonb,
  description text,
  localized_description jsonb,
  aspect_ratio text not null default '4:5',
  templates jsonb not null,
  style_guide jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  is_featured boolean not null default false,
  featured_order integer,
  category text,
  example_images jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists html_design_presets_system_idx
  on public.html_design_presets (is_system, category)
  where is_system = true;

create index if not exists html_design_presets_account_idx
  on public.html_design_presets (account_id)
  where account_id is not null;

create or replace function public.html_design_presets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists html_design_presets_updated_at on public.html_design_presets;
create trigger html_design_presets_updated_at
  before update on public.html_design_presets
  for each row execute function public.html_design_presets_set_updated_at();

-- ============================================================
-- 2) html columns on carousel_projects
-- ============================================================
alter table public.carousel_projects
  add column if not exists html_preset_id uuid references public.html_design_presets(id) on delete set null,
  add column if not exists html_style_guide jsonb,
  add column if not exists html_generation_status text not null default 'idle'
    check (html_generation_status in ('idle', 'generating', 'partial', 'complete', 'failed')),
  add column if not exists html_generation_id uuid;

-- ============================================================
-- 3) html_project_slides
-- ============================================================
create table if not exists public.html_project_slides (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.carousel_projects(id) on delete cascade,
  slide_index smallint not null check (slide_index >= 0 and slide_index <= 5),
  html text,
  page_title text,
  page_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slide_index)
);

create index if not exists html_project_slides_project_idx
  on public.html_project_slides (project_id, slide_index);

create or replace function public.html_project_slides_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists html_project_slides_updated_at on public.html_project_slides;
create trigger html_project_slides_updated_at
  before update on public.html_project_slides
  for each row execute function public.html_project_slides_set_updated_at();

create or replace function public.html_project_slides_touch_project()
returns trigger as $$
begin
  update public.carousel_projects
  set updated_at = now()
  where id = coalesce(new.project_id, old.project_id);
  return null;
end;
$$ language plpgsql;

drop trigger if exists html_project_slides_touch_project on public.html_project_slides;
create trigger html_project_slides_touch_project
  after insert or update or delete on public.html_project_slides
  for each row execute function public.html_project_slides_touch_project();

-- ============================================================
-- 4) RLS
-- Mirrors the existing carousel project/account membership rules.
-- ============================================================
alter table public.html_project_slides enable row level security;
alter table public.html_design_presets enable row level security;

drop policy if exists "html_project_slides_select_account_member" on public.html_project_slides;
create policy "html_project_slides_select_account_member"
  on public.html_project_slides
  for select
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.html_project_slides.project_id
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

drop policy if exists "html_project_slides_insert_account_admin_owner" on public.html_project_slides;
create policy "html_project_slides_insert_account_admin_owner"
  on public.html_project_slides
  for insert
  with check (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.html_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "html_project_slides_update_account_admin_owner" on public.html_project_slides;
create policy "html_project_slides_update_account_admin_owner"
  on public.html_project_slides
  for update
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.html_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
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
      where p.id = public.html_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "html_project_slides_delete_account_admin_owner" on public.html_project_slides;
create policy "html_project_slides_delete_account_admin_owner"
  on public.html_project_slides
  for delete
  using (
    exists (
      select 1
      from public.carousel_projects p
      where p.id = public.html_project_slides.project_id
        and (
          (p.account_id is not null and exists (
            select 1
            from public.editor_account_memberships m
            where m.account_id = p.account_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
          ))
          or
          (p.account_id is null and p.owner_user_id = auth.uid())
        )
    )
  );

drop policy if exists "html_design_presets_select_system_or_member" on public.html_design_presets;
create policy "html_design_presets_select_system_or_member"
  on public.html_design_presets
  for select
  using (
    is_system = true
    or (
      account_id is not null
      and exists (
        select 1
        from public.editor_account_memberships m
        where m.account_id = public.html_design_presets.account_id
          and m.user_id = auth.uid()
      )
    )
  );

drop policy if exists "html_design_presets_insert_account_admin_owner" on public.html_design_presets;
create policy "html_design_presets_insert_account_admin_owner"
  on public.html_design_presets
  for insert
  with check (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.html_design_presets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "html_design_presets_update_account_admin_owner" on public.html_design_presets;
create policy "html_design_presets_update_account_admin_owner"
  on public.html_design_presets
  for update
  using (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.html_design_presets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.html_design_presets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "html_design_presets_delete_account_admin_owner" on public.html_design_presets;
create policy "html_design_presets_delete_account_admin_owner"
  on public.html_design_presets
  for delete
  using (
    account_id is not null
    and exists (
      select 1
      from public.editor_account_memberships m
      where m.account_id = public.html_design_presets.account_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

grant all on public.html_project_slides to authenticated;
grant all on public.html_design_presets to authenticated;
