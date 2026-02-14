-- Editor: Outreach targets (Reel/Post sources)
-- Extends public.editor_outreach_targets so we can persist Reel/Post scrape metadata + media storage.

alter table if exists public.editor_outreach_targets
  add column if not exists source_post_url text null,
  add column if not exists source_post_shortcode text null,
  add column if not exists source_post_caption text null,
  add column if not exists source_post_transcript text null,
  add column if not exists source_post_video_storage_bucket text null,
  add column if not exists source_post_video_storage_path text null,
  add column if not exists source_post_raw_json jsonb null,
  add column if not exists source_post_scraped_at timestamptz null,
  add column if not exists source_post_whisper_used boolean null;

-- Helpful index for looking up outreach rows by created project.
create index if not exists editor_outreach_targets_created_project_id_idx
  on public.editor_outreach_targets (created_project_id);

