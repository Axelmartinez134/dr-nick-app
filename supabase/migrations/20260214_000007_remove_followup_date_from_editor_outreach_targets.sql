-- Editor: Outreach targets (Pipeline) - remove followup date

-- Drop index that referenced followup_date (if present).
drop index if exists public.editor_outreach_targets_account_pipeline_stage_followup_created_at_idx;

alter table if exists public.editor_outreach_targets
  drop column if exists followup_date;

-- Replacement index (no followup).
create index if not exists editor_outreach_targets_account_pipeline_stage_created_at_idx
  on public.editor_outreach_targets (account_id, pipeline_stage, created_at desc);

