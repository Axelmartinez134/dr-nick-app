-- Phase 4 follow-up: seed compatibility row for HTML template type.
-- Even though html does not use Fabric template settings in v1, the existing
-- carousel_projects.template_type_id foreign key still points at
-- public.carousel_template_types(id), so the html id must exist.

insert into public.carousel_template_types (
  id,
  label,
  default_prompt,
  default_emphasis_prompt,
  default_image_gen_prompt,
  default_slide1_template_id,
  default_slide2_5_template_id,
  default_slide6_template_id
)
values (
  'html',
  'HTML',
  '',
  '',
  '',
  null,
  null,
  null
)
on conflict (id) do update
set
  label = excluded.label,
  default_prompt = excluded.default_prompt,
  default_emphasis_prompt = excluded.default_emphasis_prompt,
  default_image_gen_prompt = excluded.default_image_gen_prompt,
  default_slide1_template_id = excluded.default_slide1_template_id,
  default_slide2_5_template_id = excluded.default_slide2_5_template_id,
  default_slide6_template_id = excluded.default_slide6_template_id;
