-- Editor: Outreach targets (Instagram DM execution visibility)
-- Persist latest outbound execution state and an append-only audit trail.

alter table if exists public.editor_outreach_targets
  add column if not exists instagram_dm_last_execution_state text null,
  add column if not exists instagram_dm_last_execution_at timestamptz null,
  add column if not exists instagram_dm_last_execution_error text null,
  add column if not exists instagram_dm_last_followup_number smallint null,
  add column if not exists instagram_dm_last_followup_message text null,
  add column if not exists instagram_dm_last_execution_run_artifact_path text null;

create table if not exists public.editor_outreach_dm_execution_events (
  id bigserial primary key,
  account_id uuid not null,
  outreach_target_id uuid not null,
  username text not null,
  thread_url text null,
  event_type text not null,
  followup_number smallint null,
  message_text text null,
  classification_state text null,
  recommended_action text null,
  artifact_path text null,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists editor_outreach_dm_execution_events_account_created_at_idx
  on public.editor_outreach_dm_execution_events (account_id, created_at desc);

create index if not exists editor_outreach_dm_execution_events_target_created_at_idx
  on public.editor_outreach_dm_execution_events (outreach_target_id, created_at desc);
