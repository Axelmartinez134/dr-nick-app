-- Daily Digest
-- Per-user + per-account AI digest pipeline built on top of the shared yt_rss cache.

create table if not exists public.daily_digest_creator_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  yt_creator_id uuid not null references public.yt_creators(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz null
);

create unique index if not exists daily_digest_creator_settings_user_account_creator_uidx
  on public.daily_digest_creator_settings (user_id, account_id, yt_creator_id);

create index if not exists daily_digest_creator_settings_user_account_enabled_idx
  on public.daily_digest_creator_settings (user_id, account_id, enabled, updated_at desc);

alter table public.daily_digest_creator_settings enable row level security;

drop policy if exists "daily_digest_creator_settings_select_superadmin_owner" on public.daily_digest_creator_settings;
create policy "daily_digest_creator_settings_select_superadmin_owner"
  on public.daily_digest_creator_settings
  for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_creator_settings_insert_superadmin_owner" on public.daily_digest_creator_settings;
create policy "daily_digest_creator_settings_insert_superadmin_owner"
  on public.daily_digest_creator_settings
  for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_creator_settings_update_superadmin_owner" on public.daily_digest_creator_settings;
create policy "daily_digest_creator_settings_update_superadmin_owner"
  on public.daily_digest_creator_settings
  for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_creator_settings_delete_superadmin_owner" on public.daily_digest_creator_settings;
create policy "daily_digest_creator_settings_delete_superadmin_owner"
  on public.daily_digest_creator_settings
  for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.daily_digest_creator_settings to authenticated;

create table if not exists public.daily_digest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null default 'running',
  videos_discovered integer not null default 0,
  videos_processed integer not null default 0,
  videos_failed integer not null default 0,
  videos_pending integer not null default 0,
  topics_extracted integer not null default 0,
  prompt_source text null,
  prompt_used text null,
  run_errors jsonb not null default '[]'::jsonb,
  error_message text null,
  constraint daily_digest_runs_status_check
    check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  constraint daily_digest_runs_prompt_source_check
    check (prompt_source is null or prompt_source in ('default', 'override'))
);

create index if not exists daily_digest_runs_user_account_started_idx
  on public.daily_digest_runs (user_id, account_id, started_at desc);

create index if not exists daily_digest_runs_user_account_status_started_idx
  on public.daily_digest_runs (user_id, account_id, status, started_at desc);

alter table public.daily_digest_runs enable row level security;

drop policy if exists "daily_digest_runs_select_superadmin_owner" on public.daily_digest_runs;
create policy "daily_digest_runs_select_superadmin_owner"
  on public.daily_digest_runs
  for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_runs_insert_superadmin_owner" on public.daily_digest_runs;
create policy "daily_digest_runs_insert_superadmin_owner"
  on public.daily_digest_runs
  for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_runs_update_superadmin_owner" on public.daily_digest_runs;
create policy "daily_digest_runs_update_superadmin_owner"
  on public.daily_digest_runs
  for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_runs_delete_superadmin_owner" on public.daily_digest_runs;
create policy "daily_digest_runs_delete_superadmin_owner"
  on public.daily_digest_runs
  for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.daily_digest_runs to authenticated;

create table if not exists public.daily_digest_videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  yt_video_id uuid null references public.yt_videos(id) on delete set null,
  digest_run_id uuid null references public.daily_digest_runs(id) on delete set null,
  status text not null default 'pending',
  retry_count integer not null default 0,
  error_message text null,
  youtube_video_url text not null,
  video_title text not null,
  creator_name text not null,
  thumbnail_url text null,
  published_at timestamptz not null,
  summary text null,
  unique_viewpoints jsonb null,
  transcript_char_count integer null,
  raw_transcript text null,
  constraint daily_digest_videos_status_check
    check (status in ('pending', 'enriching', 'distilling', 'completed', 'failed'))
);

create unique index if not exists daily_digest_videos_user_account_yt_video_uidx
  on public.daily_digest_videos (user_id, account_id, yt_video_id);

create index if not exists daily_digest_videos_user_account_published_idx
  on public.daily_digest_videos (user_id, account_id, published_at desc);

create index if not exists daily_digest_videos_user_account_status_published_idx
  on public.daily_digest_videos (user_id, account_id, status, published_at desc);

create index if not exists daily_digest_videos_digest_run_idx
  on public.daily_digest_videos (digest_run_id, published_at desc);

alter table public.daily_digest_videos enable row level security;

drop policy if exists "daily_digest_videos_select_superadmin_owner" on public.daily_digest_videos;
create policy "daily_digest_videos_select_superadmin_owner"
  on public.daily_digest_videos
  for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_videos_insert_superadmin_owner" on public.daily_digest_videos;
create policy "daily_digest_videos_insert_superadmin_owner"
  on public.daily_digest_videos
  for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_videos_update_superadmin_owner" on public.daily_digest_videos;
create policy "daily_digest_videos_update_superadmin_owner"
  on public.daily_digest_videos
  for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_videos_delete_superadmin_owner" on public.daily_digest_videos;
create policy "daily_digest_videos_delete_superadmin_owner"
  on public.daily_digest_videos
  for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.daily_digest_videos to authenticated;

create table if not exists public.daily_digest_topics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  digest_video_id uuid not null references public.daily_digest_videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  title text not null,
  what_it_is text not null,
  why_it_matters text not null,
  carousel_angle text null,
  status text not null default 'active',
  note text null,
  sort_order integer not null default 0,
  constraint daily_digest_topics_status_check
    check (status in ('active', 'dismissed', 'starred'))
);

create index if not exists daily_digest_topics_digest_video_sort_idx
  on public.daily_digest_topics (digest_video_id, sort_order asc, created_at asc);

create index if not exists daily_digest_topics_user_account_status_idx
  on public.daily_digest_topics (user_id, account_id, status, created_at desc);

alter table public.daily_digest_topics enable row level security;

drop policy if exists "daily_digest_topics_select_superadmin_owner" on public.daily_digest_topics;
create policy "daily_digest_topics_select_superadmin_owner"
  on public.daily_digest_topics
  for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_topics_insert_superadmin_owner" on public.daily_digest_topics;
create policy "daily_digest_topics_insert_superadmin_owner"
  on public.daily_digest_topics
  for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_topics_update_superadmin_owner" on public.daily_digest_topics;
create policy "daily_digest_topics_update_superadmin_owner"
  on public.daily_digest_topics
  for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_topics_delete_superadmin_owner" on public.daily_digest_topics;
create policy "daily_digest_topics_delete_superadmin_owner"
  on public.daily_digest_topics
  for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.daily_digest_topics to authenticated;

create table if not exists public.daily_digest_prompt_overrides (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  distill_prompt text not null default ''
);

create unique index if not exists daily_digest_prompt_overrides_user_account_uidx
  on public.daily_digest_prompt_overrides (user_id, account_id);

alter table public.daily_digest_prompt_overrides enable row level security;

drop policy if exists "daily_digest_prompt_overrides_select_superadmin_owner" on public.daily_digest_prompt_overrides;
create policy "daily_digest_prompt_overrides_select_superadmin_owner"
  on public.daily_digest_prompt_overrides
  for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_prompt_overrides_insert_superadmin_owner" on public.daily_digest_prompt_overrides;
create policy "daily_digest_prompt_overrides_insert_superadmin_owner"
  on public.daily_digest_prompt_overrides
  for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_prompt_overrides_update_superadmin_owner" on public.daily_digest_prompt_overrides;
create policy "daily_digest_prompt_overrides_update_superadmin_owner"
  on public.daily_digest_prompt_overrides
  for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "daily_digest_prompt_overrides_delete_superadmin_owner" on public.daily_digest_prompt_overrides;
create policy "daily_digest_prompt_overrides_delete_superadmin_owner"
  on public.daily_digest_prompt_overrides
  for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.daily_digest_prompt_overrides to authenticated;

create or replace function public.update_daily_digest_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_daily_digest_creator_settings_updated_at on public.daily_digest_creator_settings;
create trigger trigger_update_daily_digest_creator_settings_updated_at
  before update on public.daily_digest_creator_settings
  for each row
  execute function public.update_daily_digest_updated_at();

drop trigger if exists trigger_update_daily_digest_videos_updated_at on public.daily_digest_videos;
create trigger trigger_update_daily_digest_videos_updated_at
  before update on public.daily_digest_videos
  for each row
  execute function public.update_daily_digest_updated_at();

drop trigger if exists trigger_update_daily_digest_topics_updated_at on public.daily_digest_topics;
create trigger trigger_update_daily_digest_topics_updated_at
  before update on public.daily_digest_topics
  for each row
  execute function public.update_daily_digest_updated_at();

drop trigger if exists trigger_update_daily_digest_prompt_overrides_updated_at on public.daily_digest_prompt_overrides;
create trigger trigger_update_daily_digest_prompt_overrides_updated_at
  before update on public.daily_digest_prompt_overrides
  for each row
  execute function public.update_daily_digest_updated_at();
