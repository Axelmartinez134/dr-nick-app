-- Editor users gate
-- - Postgres table:
--   - editor_users: controls access to /editor via RLS

-- =========================
-- 1) Editor users table
-- =========================
CREATE TABLE IF NOT EXISTS public.editor_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.editor_users ENABLE ROW LEVEL SECURITY;

-- Only an authenticated user can view their own membership row (used by the app to check access).
DROP POLICY IF EXISTS "Editor users: select self only" ON public.editor_users;
CREATE POLICY "Editor users: select self only"
  ON public.editor_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: manage via Supabase Dashboard / SQL editor or service role.

GRANT ALL ON public.editor_users TO authenticated;


