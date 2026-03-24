-- /editor: Carousel Map (V1)
-- Persistent map workspace for source -> topics -> opening pairs -> expansions.
-- Superadmin-only and account-scoped (mirrors Swipe File ideas/chat access model).

-- =========================
-- 1) Root map
-- =========================
create table if not exists public.carousel_maps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  swipe_item_id uuid not null references public.swipe_file_items(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  selected_topic_id uuid null,
  selected_slide1_source_pair_id uuid null,
  selected_slide1_text text null,
  selected_slide2_source_pair_id uuid null,
  selected_slide2_text text null
);

create unique index if not exists carousel_maps_account_item_uidx
  on public.carousel_maps (account_id, swipe_item_id);

create index if not exists carousel_maps_account_created_at_idx
  on public.carousel_maps (account_id, created_at desc);

alter table public.carousel_maps enable row level security;

drop policy if exists "carousel_maps_select_superadmin" on public.carousel_maps;
create policy "carousel_maps_select_superadmin"
  on public.carousel_maps
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_maps_insert_superadmin" on public.carousel_maps;
create policy "carousel_maps_insert_superadmin"
  on public.carousel_maps
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_maps_update_superadmin" on public.carousel_maps;
create policy "carousel_maps_update_superadmin"
  on public.carousel_maps
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_maps_delete_superadmin" on public.carousel_maps;
create policy "carousel_maps_delete_superadmin"
  on public.carousel_maps
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_maps to authenticated;

-- =========================
-- 2) Topics
-- =========================
create table if not exists public.carousel_map_topics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  source_generation_key uuid not null,
  sort_order integer not null default 0,
  title text not null,
  summary text not null,
  why_it_matters text not null
);

create index if not exists carousel_map_topics_map_created_at_idx
  on public.carousel_map_topics (carousel_map_id, created_at asc);

create index if not exists carousel_map_topics_map_generation_idx
  on public.carousel_map_topics (carousel_map_id, source_generation_key, sort_order asc);

create index if not exists carousel_map_topics_account_created_at_idx
  on public.carousel_map_topics (account_id, created_at desc);

alter table public.carousel_map_topics enable row level security;

drop policy if exists "carousel_map_topics_select_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_select_superadmin"
  on public.carousel_map_topics
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_topics_insert_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_insert_superadmin"
  on public.carousel_map_topics
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_topics_update_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_update_superadmin"
  on public.carousel_map_topics
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_topics_delete_superadmin" on public.carousel_map_topics;
create policy "carousel_map_topics_delete_superadmin"
  on public.carousel_map_topics
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_topics to authenticated;

-- =========================
-- 3) Opening pairs
-- =========================
create table if not exists public.carousel_map_opening_pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  topic_id uuid not null references public.carousel_map_topics(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  source_generation_key uuid not null,
  sort_order integer not null default 0,
  title text not null,
  slide1 text not null,
  slide2 text not null,
  angle_text text not null
);

create index if not exists carousel_map_opening_pairs_map_created_at_idx
  on public.carousel_map_opening_pairs (carousel_map_id, created_at asc);

create index if not exists carousel_map_opening_pairs_topic_generation_idx
  on public.carousel_map_opening_pairs (topic_id, source_generation_key, sort_order asc);

create index if not exists carousel_map_opening_pairs_account_created_at_idx
  on public.carousel_map_opening_pairs (account_id, created_at desc);

alter table public.carousel_map_opening_pairs enable row level security;

drop policy if exists "carousel_map_opening_pairs_select_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_select_superadmin"
  on public.carousel_map_opening_pairs
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_opening_pairs_insert_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_insert_superadmin"
  on public.carousel_map_opening_pairs
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_opening_pairs_update_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_update_superadmin"
  on public.carousel_map_opening_pairs
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_opening_pairs_delete_superadmin" on public.carousel_map_opening_pairs;
create policy "carousel_map_opening_pairs_delete_superadmin"
  on public.carousel_map_opening_pairs
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_opening_pairs to authenticated;

-- =========================
-- 4) Expansions
-- =========================
create table if not exists public.carousel_map_expansions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  topic_id uuid not null references public.carousel_map_topics(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  source_generation_key uuid not null,
  sort_order integer not null default 0,
  selected_slide1_source_pair_id uuid null references public.carousel_map_opening_pairs(id) on delete set null,
  selected_slide2_source_pair_id uuid null references public.carousel_map_opening_pairs(id) on delete set null,
  selected_slide1_text text not null,
  selected_slide2_text text not null,
  slide3 text not null,
  slide4 text not null,
  slide5 text not null,
  slide6 text not null
);

create index if not exists carousel_map_expansions_map_created_at_idx
  on public.carousel_map_expansions (carousel_map_id, created_at asc);

create index if not exists carousel_map_expansions_topic_generation_idx
  on public.carousel_map_expansions (topic_id, source_generation_key, sort_order asc);

create index if not exists carousel_map_expansions_account_created_at_idx
  on public.carousel_map_expansions (account_id, created_at desc);

alter table public.carousel_map_expansions enable row level security;

drop policy if exists "carousel_map_expansions_select_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_select_superadmin"
  on public.carousel_map_expansions
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_expansions_insert_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_insert_superadmin"
  on public.carousel_map_expansions
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_expansions_update_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_update_superadmin"
  on public.carousel_map_expansions
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_expansions_delete_superadmin" on public.carousel_map_expansions;
create policy "carousel_map_expansions_delete_superadmin"
  on public.carousel_map_expansions
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_expansions to authenticated;

-- =========================
-- 5) Back-references on root map
-- =========================
alter table public.carousel_maps
  drop constraint if exists carousel_maps_selected_topic_id_fkey;

alter table public.carousel_maps
  add constraint carousel_maps_selected_topic_id_fkey
  foreign key (selected_topic_id)
  references public.carousel_map_topics(id)
  on delete set null;

alter table public.carousel_maps
  drop constraint if exists carousel_maps_selected_slide1_source_pair_id_fkey;

alter table public.carousel_maps
  add constraint carousel_maps_selected_slide1_source_pair_id_fkey
  foreign key (selected_slide1_source_pair_id)
  references public.carousel_map_opening_pairs(id)
  on delete set null;

alter table public.carousel_maps
  drop constraint if exists carousel_maps_selected_slide2_source_pair_id_fkey;

alter table public.carousel_maps
  add constraint carousel_maps_selected_slide2_source_pair_id_fkey
  foreign key (selected_slide2_source_pair_id)
  references public.carousel_map_opening_pairs(id)
  on delete set null;

-- =========================
-- 6) updated_at trigger on root map
-- =========================
create or replace function public.touch_carousel_maps_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_touch_carousel_maps_updated_at on public.carousel_maps;
create trigger trigger_touch_carousel_maps_updated_at
  before update on public.carousel_maps
  for each row
  execute function public.touch_carousel_maps_updated_at();
