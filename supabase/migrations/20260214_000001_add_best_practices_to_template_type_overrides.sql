-- Editor: Best Practices prompt (Phase 9)
-- Adds a per-account + per-template-type "Best Practices" prompt used only for Reel/Post outreach copy generation.

alter table if exists public.carousel_template_type_overrides
  add column if not exists best_practices_override text null;

