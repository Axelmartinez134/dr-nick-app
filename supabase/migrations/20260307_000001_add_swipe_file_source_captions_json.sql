-- Swipe File: store raw captions array / segments for sources (YouTube V1)

alter table if exists public.swipe_file_items
  add column if not exists source_captions_json jsonb null;

