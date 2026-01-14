-- Add job_type and slide_index columns to carousel_generation_jobs
-- This enables tracking different job types (generate-copy, generate-ai-image) and slide-specific jobs

-- Add job_type column (nullable for backwards compatibility)
ALTER TABLE public.carousel_generation_jobs
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'generate-copy';

COMMENT ON COLUMN public.carousel_generation_jobs.job_type IS
  'Type of job: generate-copy, generate-ai-image, etc.';

-- Add slide_index column (nullable - only used for slide-specific jobs like AI image generation)
ALTER TABLE public.carousel_generation_jobs
ADD COLUMN IF NOT EXISTS slide_index INTEGER;

COMMENT ON COLUMN public.carousel_generation_jobs.slide_index IS
  'Slide index (0-5) for slide-specific jobs like AI image generation. NULL for project-wide jobs.';

-- Update existing rows to have job_type = 'generate-copy' (they're all copy generation jobs)
UPDATE public.carousel_generation_jobs
SET job_type = 'generate-copy'
WHERE job_type IS NULL;
