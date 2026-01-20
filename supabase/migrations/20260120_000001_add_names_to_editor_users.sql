-- Add editor user names (for /editor UI greeting)
-- - Keep nullable; values are managed manually in Supabase Dashboard.

ALTER TABLE public.editor_users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

