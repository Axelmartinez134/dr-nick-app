-- Editor: Outreach targets (Pipeline) - follow-up sent count
-- Persist the number of follow-ups sent (1..3) for pipeline leads.

alter table if exists public.editor_outreach_targets
  add column if not exists followup_sent_count smallint null;

-- Best-effort constraint (allow NULL or 1..3).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'editor_outreach_targets_followup_sent_count_check'
  ) then
    alter table public.editor_outreach_targets
      add constraint editor_outreach_targets_followup_sent_count_check
      check (followup_sent_count is null or (followup_sent_count >= 1 and followup_sent_count <= 3));
  end if;
end
$$;

