-- Phase 1: Add AI Image Prompt fields
-- Part of AI Image Prompt Feature (see /AI_IMAGE_PROMPT_IMPLEMENTATION.md)

-- Add Image Generation Prompt to carousel_template_types (like emphasis_prompt)
-- This stores the system prompt sent to Claude for generating per-slide image prompts
ALTER TABLE public.carousel_template_types
ADD COLUMN IF NOT EXISTS default_image_gen_prompt TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.carousel_template_types.default_image_gen_prompt IS
  'System prompt for Claude to generate per-slide image prompts; editable like Poppy/Emphasis prompts.';

-- Add AI image prompt column to carousel_project_slides
-- This stores the generated/edited prompt per slide
ALTER TABLE public.carousel_project_slides
ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT;

COMMENT ON COLUMN public.carousel_project_slides.ai_image_prompt IS
  'AI-generated prompt for image generation; editable by user, auto-saved like body text.';
