-- Allow multiple concurrent generation jobs per project, scoped by job_type + slide_index.
-- Fixes: running Generate AI Image on slide 1 blocks slide 2/3 with "Failed to create job"
-- because an older unique partial index enforced "only one active job per project".
--
-- We keep safety:
-- - Only one active generate-copy job per project (slide_index NULL => coalesce to -1)
-- - Only one active generate-ai-image job per (project, slide)
-- - Different job types can run concurrently

DO $$
DECLARE
  idx RECORD;
BEGIN
  -- Drop older unique partial indexes that only scope by project_id.
  -- We detect them dynamically because index names may differ across environments.
  FOR idx IN
    SELECT c2.relname AS indexname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_class c2 ON c2.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'carousel_generation_jobs'
      AND i.indisunique
      AND pg_get_expr(i.indpred, i.indrelid) IS NOT NULL
      AND pg_get_indexdef(i.indexrelid) ILIKE '%project_id%'
      AND pg_get_indexdef(i.indexrelid) NOT ILIKE '%job_type%'
      AND pg_get_indexdef(i.indexrelid) NOT ILIKE '%slide_index%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.indexname);
  END LOOP;
END $$;

-- New unique partial index: one active job per (project, job_type, slide_index).
-- Use COALESCE so NULL values participate in uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS carousel_generation_jobs_active_unique_by_scope
ON public.carousel_generation_jobs (
  project_id,
  (COALESCE(job_type, 'generate-copy')),
  (COALESCE(slide_index, -1))
)
WHERE status IN ('pending', 'running');

