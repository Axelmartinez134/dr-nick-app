-- Add per-carousel project source notes/link (superadmin-edited; shown on public review page).
ALTER TABLE public.carousel_projects
ADD COLUMN IF NOT EXISTS review_source text;

