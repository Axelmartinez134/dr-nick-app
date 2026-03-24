-- /editor: Carousel Map -> project rewrite provenance
-- Stores the selected Carousel Map expansion snapshot on carousel_projects
-- so generate-copy can produce the final template-specific 6-slide output.

alter table if exists public.carousel_projects
  add column if not exists source_carousel_map_id uuid null references public.carousel_maps(id) on delete set null,
  add column if not exists source_carousel_map_expansion_id uuid null references public.carousel_map_expansions(id) on delete set null,
  add column if not exists source_carousel_map_topic_snapshot text null,
  add column if not exists source_carousel_map_selected_slide1_snapshot text null,
  add column if not exists source_carousel_map_selected_slide2_snapshot text null,
  add column if not exists source_carousel_map_expansion_snapshot text null;

create index if not exists carousel_projects_source_carousel_map_id_idx
  on public.carousel_projects (source_carousel_map_id);

create index if not exists carousel_projects_source_carousel_map_expansion_id_idx
  on public.carousel_projects (source_carousel_map_expansion_id);
