-- Swipe File: persist Reel media storage + whisper usage
-- Mirrors the Outreach "source post" media storage fields for reliability.

alter table if exists public.swipe_file_items
  add column if not exists source_post_shortcode text null,
  add column if not exists source_post_video_storage_bucket text null,
  add column if not exists source_post_video_storage_path text null,
  add column if not exists source_post_whisper_used boolean null;

create index if not exists swipe_file_items_source_post_video_storage_path_idx
  on public.swipe_file_items (source_post_video_storage_path);

