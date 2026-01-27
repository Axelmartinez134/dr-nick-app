-- Editor: Ideas (Phase 3+)
-- Allow users to delete their own idea sources (and cascaded runs/ideas).

-- Sources
DROP POLICY IF EXISTS "editor_idea_sources_delete_own" ON public.editor_idea_sources;
CREATE POLICY "editor_idea_sources_delete_own"
  ON public.editor_idea_sources
  FOR DELETE
  USING (owner_user_id = auth.uid());

-- Runs (defensive: allow explicit deletes as well; cascades may still reference these)
DROP POLICY IF EXISTS "editor_idea_runs_delete_own" ON public.editor_idea_runs;
CREATE POLICY "editor_idea_runs_delete_own"
  ON public.editor_idea_runs
  FOR DELETE
  USING (owner_user_id = auth.uid());

-- Ideas (defensive)
DROP POLICY IF EXISTS "editor_ideas_delete_own" ON public.editor_ideas;
CREATE POLICY "editor_ideas_delete_own"
  ON public.editor_ideas
  FOR DELETE
  USING (owner_user_id = auth.uid());

