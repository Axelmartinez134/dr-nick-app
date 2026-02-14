-- Editor: Outreach message (Phase: keep DM separate from IG caption)
-- Store the outreach DM message on the project so Generate Copy can safely overwrite `caption`.

alter table if exists public.carousel_projects
  add column if not exists outreach_message text null;

