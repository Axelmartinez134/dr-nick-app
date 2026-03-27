-- /editor: Carousel Map steering memory for generation lanes
-- Persists scoped steering notes for topics, opening pairs, and expansions.

create table if not exists public.carousel_map_generation_steering (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  carousel_map_id uuid not null references public.carousel_maps(id) on delete cascade,
  stage_key text not null,
  scope_key text not null,
  topic_id uuid null references public.carousel_map_topics(id) on delete cascade,
  opening_signature text null,
  steering_text text not null default '',
  last_used_steering_text text null,
  last_used_at timestamptz null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  constraint carousel_map_generation_steering_stage_key_check
    check (stage_key in ('topics', 'opening_pairs', 'expansions'))
);

create unique index if not exists carousel_map_generation_steering_scope_uidx
  on public.carousel_map_generation_steering (account_id, carousel_map_id, stage_key, scope_key);

create index if not exists carousel_map_generation_steering_map_idx
  on public.carousel_map_generation_steering (carousel_map_id, stage_key, updated_at desc);

create index if not exists carousel_map_generation_steering_topic_idx
  on public.carousel_map_generation_steering (topic_id, stage_key, updated_at desc);

alter table public.carousel_map_generation_steering enable row level security;

drop policy if exists "carousel_map_generation_steering_select_superadmin" on public.carousel_map_generation_steering;
create policy "carousel_map_generation_steering_select_superadmin"
  on public.carousel_map_generation_steering
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_generation_steering_insert_superadmin" on public.carousel_map_generation_steering;
create policy "carousel_map_generation_steering_insert_superadmin"
  on public.carousel_map_generation_steering
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_generation_steering_update_superadmin" on public.carousel_map_generation_steering;
create policy "carousel_map_generation_steering_update_superadmin"
  on public.carousel_map_generation_steering
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "carousel_map_generation_steering_delete_superadmin" on public.carousel_map_generation_steering;
create policy "carousel_map_generation_steering_delete_superadmin"
  on public.carousel_map_generation_steering
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.carousel_map_generation_steering to authenticated;

create or replace function public.touch_carousel_map_generation_steering_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_touch_carousel_map_generation_steering_updated_at on public.carousel_map_generation_steering;
create trigger trigger_touch_carousel_map_generation_steering_updated_at
  before update on public.carousel_map_generation_steering
  for each row
  execute function public.touch_carousel_map_generation_steering_updated_at();
