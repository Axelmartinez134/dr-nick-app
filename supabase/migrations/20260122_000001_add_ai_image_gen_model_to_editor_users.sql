-- Per-editor-user AI image generation model (Enhanced /editor)
-- Default is OpenAI GPT Image, so existing users see no behavior change until they switch.
--
-- NOTE: Values are controlled by the app via a server route (service role), not direct client writes.

ALTER TABLE public.editor_users
  ADD COLUMN IF NOT EXISTS ai_image_gen_model TEXT NOT NULL DEFAULT 'gpt-image-1.5';

