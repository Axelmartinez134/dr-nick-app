-- Soft-archive support for editor projects.
-- Archived projects should not show in the Saved Projects dropdown, but remain in DB.

ALTER TABLE IF EXISTS public.carousel_projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Help "active projects" queries remain fast as table grows.
CREATE INDEX IF NOT EXISTS carousel_projects_owner_updated_active_idx
  ON public.carousel_projects (owner_user_id, updated_at DESC)
  WHERE archived_at IS NULL;

