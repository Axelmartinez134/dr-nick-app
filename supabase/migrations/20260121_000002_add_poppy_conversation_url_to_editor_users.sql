-- Per-editor-user Poppy routing
-- Each editor user can point Generate Copy to a different Poppy board/chat (and model).
-- This is managed manually in Supabase Dashboard / SQL (no client-side writes).

ALTER TABLE public.editor_users
  ADD COLUMN IF NOT EXISTS poppy_conversation_url TEXT;

