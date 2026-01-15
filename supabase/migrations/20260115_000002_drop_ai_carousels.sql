-- Drop legacy ai_carousels feature (deprecated)
-- Note: we intentionally do NOT delete any other tables used by /editor (carousel_projects, carousel_templates, etc.)

DROP TABLE IF EXISTS public.ai_carousels CASCADE;

-- Clean up helper objects created by legacy migrations (safe if missing)
DROP FUNCTION IF EXISTS public.update_ai_carousels_updated_at() CASCADE;

