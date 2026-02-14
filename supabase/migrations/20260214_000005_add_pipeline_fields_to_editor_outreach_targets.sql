-- Editor: Outreach targets (Pipeline fields)
-- Adds lightweight CRM/pipeline state to public.editor_outreach_targets.

alter table if exists public.editor_outreach_targets
  add column if not exists pipeline_stage text null,
  add column if not exists pipeline_added_at timestamptz null,
  add column if not exists last_contact_date date null,
  add column if not exists followup_date date null;

create index if not exists editor_outreach_targets_account_pipeline_stage_followup_created_at_idx
  on public.editor_outreach_targets (account_id, pipeline_stage, followup_date asc nulls last, created_at desc);

