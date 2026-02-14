-- Editor: Outreach targets (Pipeline + CRM updates)
-- Allow superadmins to UPDATE rows under RLS.

alter table public.editor_outreach_targets enable row level security;

drop policy if exists "editor_outreach_targets_update_superadmin" on public.editor_outreach_targets;
create policy "editor_outreach_targets_update_superadmin"
  on public.editor_outreach_targets
  for update
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

