alter table public.html_design_presets
  add column if not exists is_visible boolean not null default true;

update public.html_design_presets
set is_visible = true
where is_visible is distinct from true;

update public.html_design_presets
set templates = rewritten.templates
from (
  select
    presets.id,
    jsonb_agg(
      case
        when jsonb_typeof(template_entry) = 'object' and template_entry ? 'pageType' then template_entry
        when jsonb_typeof(template_entry) = 'object' and template_entry ? 'role'
          then (template_entry - 'role') || jsonb_build_object('pageType', template_entry->'role')
        else template_entry
      end
    ) as templates
  from public.html_design_presets presets
  cross join lateral jsonb_array_elements(coalesce(presets.templates, '[]'::jsonb)) as template_entry
  group by presets.id
) as rewritten
where public.html_design_presets.id = rewritten.id
  and coalesce(public.html_design_presets.templates, '[]'::jsonb) is distinct from coalesce(rewritten.templates, '[]'::jsonb);
