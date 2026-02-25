-- Swipe File (Linkwarden-inspired) — MVP
-- Superadmin-only content library for saving and enriching links.

-- =========================
-- 0) Swipe categories
-- =========================
create table if not exists public.swipe_file_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create unique index if not exists swipe_file_categories_account_name_uidx
  on public.swipe_file_categories (account_id, lower(name));

create index if not exists swipe_file_categories_account_sort_idx
  on public.swipe_file_categories (account_id, sort_order asc, created_at asc);

alter table public.swipe_file_categories enable row level security;

drop policy if exists "swipe_file_categories_select_superadmin" on public.swipe_file_categories;
create policy "swipe_file_categories_select_superadmin"
  on public.swipe_file_categories
  for select
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "swipe_file_categories_insert_superadmin" on public.swipe_file_categories;
create policy "swipe_file_categories_insert_superadmin"
  on public.swipe_file_categories
  for insert
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "swipe_file_categories_update_superadmin" on public.swipe_file_categories;
create policy "swipe_file_categories_update_superadmin"
  on public.swipe_file_categories
  for update
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "swipe_file_categories_delete_superadmin" on public.swipe_file_categories;
create policy "swipe_file_categories_delete_superadmin"
  on public.swipe_file_categories
  for delete
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

grant all on public.swipe_file_categories to authenticated;

-- =========================
-- 1) Swipe items
-- =========================
create table if not exists public.swipe_file_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,

  url text not null,
  platform text not null default 'unknown', -- instagram|youtube|tiktok|x|web|unknown
  status text not null default 'new', -- new|reviewed|repurposed|archived
  category_id uuid not null references public.swipe_file_categories(id) on delete restrict,
  tags text[] not null default '{}'::text[],
  note text null,

  -- Enrichment fields (IG in V1; others V2)
  enrich_status text not null default 'idle', -- idle|running|ok|error|needs_transcript
  enrich_error text null,
  enriched_at timestamptz null,
  caption text null,
  transcript text null,
  author_handle text null,
  title text null,
  thumb_url text null,
  raw_json jsonb null,

  -- Repurpose linkage (optional)
  created_project_id uuid null references public.carousel_projects(id) on delete set null
);

create index if not exists swipe_file_items_account_created_at_idx
  on public.swipe_file_items (account_id, created_at desc);

create index if not exists swipe_file_items_account_category_created_at_idx
  on public.swipe_file_items (account_id, category_id, created_at desc);

create index if not exists swipe_file_items_account_platform_created_at_idx
  on public.swipe_file_items (account_id, platform, created_at desc);

create index if not exists swipe_file_items_account_status_created_at_idx
  on public.swipe_file_items (account_id, status, created_at desc);

create index if not exists swipe_file_items_tags_gin_idx
  on public.swipe_file_items using gin (tags);

alter table public.swipe_file_items enable row level security;

drop policy if exists "swipe_file_items_select_superadmin" on public.swipe_file_items;
create policy "swipe_file_items_select_superadmin"
  on public.swipe_file_items
  for select
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "swipe_file_items_insert_superadmin" on public.swipe_file_items;
create policy "swipe_file_items_insert_superadmin"
  on public.swipe_file_items
  for insert
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "swipe_file_items_update_superadmin" on public.swipe_file_items;
create policy "swipe_file_items_update_superadmin"
  on public.swipe_file_items
  for update
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "swipe_file_items_delete_superadmin" on public.swipe_file_items;
create policy "swipe_file_items_delete_superadmin"
  on public.swipe_file_items
  for delete
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

grant all on public.swipe_file_items to authenticated;

-- =========================
-- 2) updated_at trigger for swipe_file_items
-- =========================
create or replace function public.update_swipe_file_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_swipe_file_items_updated_at on public.swipe_file_items;
create trigger trigger_update_swipe_file_items_updated_at
  before update on public.swipe_file_items
  for each row
  execute function public.update_swipe_file_items_updated_at();

-- =========================
-- 3) Projects: Swipe origin snapshot fields
-- =========================
alter table if exists public.carousel_projects
  add column if not exists source_swipe_item_id uuid null references public.swipe_file_items(id) on delete set null;

alter table if exists public.carousel_projects
  add column if not exists source_swipe_angle_snapshot text null;

create index if not exists carousel_projects_source_swipe_item_id_idx
  on public.carousel_projects (source_swipe_item_id);

