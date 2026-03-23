-- YouTube RSS Feed (inside /editor Swipe File)
-- User-scoped creator/video cache with per-account Swipe File mirror mapping.

create table if not exists public.yt_creators (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  channel_name text not null,
  feed_url text not null,
  is_active boolean not null default true,
  last_refreshed_at timestamptz null,
  last_refresh_error text null
);

create unique index if not exists yt_creators_user_channel_uidx
  on public.yt_creators (user_id, channel_id);

create index if not exists yt_creators_user_created_idx
  on public.yt_creators (user_id, created_at desc);

alter table public.yt_creators enable row level security;

drop policy if exists "yt_creators_select_superadmin_owner" on public.yt_creators;
create policy "yt_creators_select_superadmin_owner"
  on public.yt_creators
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_creators_insert_superadmin_owner" on public.yt_creators;
create policy "yt_creators_insert_superadmin_owner"
  on public.yt_creators
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_creators_update_superadmin_owner" on public.yt_creators;
create policy "yt_creators_update_superadmin_owner"
  on public.yt_creators
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_creators_delete_superadmin_owner" on public.yt_creators;
create policy "yt_creators_delete_superadmin_owner"
  on public.yt_creators
  for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

grant all on public.yt_creators to authenticated;

create table if not exists public.yt_videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.yt_creators(id) on delete cascade,
  video_id text not null,
  channel_id text not null,
  channel_name text not null,
  title text not null,
  video_url text not null,
  thumbnail_url text null,
  description text null,
  published_at timestamptz not null,
  view_count integer null,
  like_count integer null,
  fetched_at timestamptz null,
  note text null,
  raw_xml text null
);

create unique index if not exists yt_videos_user_video_uidx
  on public.yt_videos (user_id, video_id);

create index if not exists yt_videos_user_creator_published_idx
  on public.yt_videos (user_id, creator_id, published_at desc);

create index if not exists yt_videos_user_published_idx
  on public.yt_videos (user_id, published_at desc);

alter table public.yt_videos enable row level security;

drop policy if exists "yt_videos_select_superadmin_owner" on public.yt_videos;
create policy "yt_videos_select_superadmin_owner"
  on public.yt_videos
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_videos_insert_superadmin_owner" on public.yt_videos;
create policy "yt_videos_insert_superadmin_owner"
  on public.yt_videos
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_videos_update_superadmin_owner" on public.yt_videos;
create policy "yt_videos_update_superadmin_owner"
  on public.yt_videos
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_videos_delete_superadmin_owner" on public.yt_videos;
create policy "yt_videos_delete_superadmin_owner"
  on public.yt_videos
  for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

grant all on public.yt_videos to authenticated;

create table if not exists public.yt_video_swipe_mirrors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  yt_video_id uuid not null references public.yt_videos(id) on delete cascade,
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  swipe_item_id uuid not null references public.swipe_file_items(id) on delete cascade
);

create unique index if not exists yt_video_swipe_mirrors_user_video_account_uidx
  on public.yt_video_swipe_mirrors (user_id, yt_video_id, account_id);

create unique index if not exists yt_video_swipe_mirrors_swipe_item_uidx
  on public.yt_video_swipe_mirrors (swipe_item_id);

create index if not exists yt_video_swipe_mirrors_user_account_idx
  on public.yt_video_swipe_mirrors (user_id, account_id, created_at desc);

alter table public.yt_video_swipe_mirrors enable row level security;

drop policy if exists "yt_video_swipe_mirrors_select_superadmin_owner" on public.yt_video_swipe_mirrors;
create policy "yt_video_swipe_mirrors_select_superadmin_owner"
  on public.yt_video_swipe_mirrors
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_video_swipe_mirrors_insert_superadmin_owner" on public.yt_video_swipe_mirrors;
create policy "yt_video_swipe_mirrors_insert_superadmin_owner"
  on public.yt_video_swipe_mirrors
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

drop policy if exists "yt_video_swipe_mirrors_delete_superadmin_owner" on public.yt_video_swipe_mirrors;
create policy "yt_video_swipe_mirrors_delete_superadmin_owner"
  on public.yt_video_swipe_mirrors
  for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editor_superadmins s where s.user_id = auth.uid()
    )
  );

grant all on public.yt_video_swipe_mirrors to authenticated;

create or replace function public.update_yt_rss_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_yt_creators_updated_at on public.yt_creators;
create trigger trigger_update_yt_creators_updated_at
  before update on public.yt_creators
  for each row
  execute function public.update_yt_rss_updated_at();

drop trigger if exists trigger_update_yt_videos_updated_at on public.yt_videos;
create trigger trigger_update_yt_videos_updated_at
  before update on public.yt_videos
  for each row
  execute function public.update_yt_rss_updated_at();
