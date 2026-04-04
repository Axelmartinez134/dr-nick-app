alter table if exists public.carousel_maps
  add column if not exists source_digest_topic_id uuid null references public.daily_digest_topics(id) on delete cascade;

alter table if exists public.swipe_file_idea_threads
  add column if not exists source_digest_topic_id uuid null references public.daily_digest_topics(id) on delete cascade;

alter table if exists public.swipe_file_ideas
  add column if not exists source_digest_topic_id uuid null references public.daily_digest_topics(id) on delete cascade;

drop index if exists public.carousel_maps_account_item_uidx;

create unique index if not exists carousel_maps_account_item_normal_uidx
  on public.carousel_maps (account_id, swipe_item_id)
  where source_digest_topic_id is null;

create unique index if not exists carousel_maps_account_digest_topic_uidx
  on public.carousel_maps (account_id, source_digest_topic_id)
  where source_digest_topic_id is not null;

drop index if exists public.swipe_file_idea_threads_account_item_mode_uidx;

create unique index if not exists swipe_file_idea_threads_account_item_mode_normal_uidx
  on public.swipe_file_idea_threads (account_id, swipe_item_id, chat_mode)
  where source_digest_topic_id is null;

create unique index if not exists swipe_file_idea_threads_account_digest_topic_mode_uidx
  on public.swipe_file_idea_threads (account_id, source_digest_topic_id, chat_mode)
  where source_digest_topic_id is not null;

create index if not exists swipe_file_ideas_account_digest_topic_created_at_idx
  on public.swipe_file_ideas (account_id, source_digest_topic_id, created_at desc);
