ALTER TABLE public.carousel_projects
ADD COLUMN IF NOT EXISTS ai_image_autoremovebg_enabled BOOLEAN NOT NULL DEFAULT true;

