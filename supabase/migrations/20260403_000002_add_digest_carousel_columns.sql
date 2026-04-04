alter table public.carousel_projects
  add column if not exists source_digest_topic_snapshot text;
