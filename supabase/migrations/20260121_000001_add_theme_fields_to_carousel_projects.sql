-- Phase 1: Theme/Style Preset foundation (project-wide, applies to all 6 slides)
-- Goal: establish a scalable project-level source of truth for theme/colors/effects.
-- Migration rule: keep existing projects' text effectively black (default #000000).

ALTER TABLE public.carousel_projects
  -- Project-wide colors (canvas base + text). These will become the canonical source of truth under Option A.
  ADD COLUMN IF NOT EXISTS project_background_color TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS project_text_color       TEXT NOT NULL DEFAULT '#000000',

  -- Future-proof effect params (dots gap/size/colors, gradients, etc.)
  ADD COLUMN IF NOT EXISTS background_effect_settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Theme provenance + UX memory (supports Custom-from-Theme, Reset, Save-as-Theme later)
  ADD COLUMN IF NOT EXISTS theme_id_last_applied TEXT,
  ADD COLUMN IF NOT EXISTS theme_is_customized  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS theme_defaults_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS last_manual_background_color TEXT,
  ADD COLUMN IF NOT EXISTS last_manual_text_color       TEXT;

-- Explicitly enforce the migration rule for existing rows (belt-and-suspenders).
UPDATE public.carousel_projects
SET project_text_color = '#000000'
WHERE project_text_color IS NULL OR project_text_color = '';

