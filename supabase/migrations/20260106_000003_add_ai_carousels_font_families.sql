-- Add persisted font families for carousel text rendering (canvas-only)
ALTER TABLE public.ai_carousels
  ADD COLUMN IF NOT EXISTS headline_font_family TEXT,
  ADD COLUMN IF NOT EXISTS body_font_family TEXT;


