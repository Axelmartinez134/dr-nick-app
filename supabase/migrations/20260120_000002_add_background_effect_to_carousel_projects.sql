-- Project-wide background effect settings for /editor (applies to all 6 slides in a project)
-- v1: n8n-style dotted background on slide canvases

ALTER TABLE public.carousel_projects
  ADD COLUMN IF NOT EXISTS background_effect_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS background_effect_type TEXT NOT NULL DEFAULT 'none';

