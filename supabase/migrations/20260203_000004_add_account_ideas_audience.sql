-- Per-account Ideas audience (used to render {{audience}}).
ALTER TABLE public.editor_account_settings
ADD COLUMN IF NOT EXISTS ideas_prompt_audience text;

