-- Editor: Outreach targets (Instagram DM thread persistence)
-- Persist discovered Instagram DM thread URLs/IDs so later automation can reuse them.

alter table if exists public.editor_outreach_targets
  add column if not exists instagram_dm_thread_url text null,
  add column if not exists instagram_dm_thread_id text null,
  add column if not exists instagram_dm_thread_discovered_at timestamptz null;
