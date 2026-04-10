-- Editor: Outreach targets (Instagram DM latest network classification visibility)
-- Persist the latest network-derived DM thread state for local review in the outreach UI.

alter table if exists public.editor_outreach_targets
  add column if not exists instagram_dm_thread_last_state text null,
  add column if not exists instagram_dm_thread_last_recommended_action text null,
  add column if not exists instagram_dm_thread_last_classified_at timestamptz null,
  add column if not exists instagram_dm_thread_last_run_artifact_path text null;
