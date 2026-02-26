-- Swipe File: Ideas Chat (Phase 2)
-- Link projects to a selected Swipe Idea (snapshot) for deterministic copy generation.

alter table if exists public.carousel_projects
  add column if not exists source_swipe_idea_id uuid null references public.swipe_file_ideas(id) on delete set null;

alter table if exists public.carousel_projects
  add column if not exists source_swipe_idea_snapshot text null;

create index if not exists carousel_projects_source_swipe_idea_id_idx
  on public.carousel_projects (source_swipe_idea_id);

