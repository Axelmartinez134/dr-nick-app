-- Add editable emphasis prompt per template type (Regular/Enhanced).
-- This mirrors how default_prompt is stored today: one global row per template type in carousel_template_types.

alter table public.carousel_template_types
add column if not exists default_emphasis_prompt text not null default '';

