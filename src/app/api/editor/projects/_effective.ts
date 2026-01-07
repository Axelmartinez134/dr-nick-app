import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mergeTemplateTypeDefaults,
  type TemplateTypeDefaultsRow,
  type TemplateTypeId,
} from '../_utils';

export async function loadEffectiveTemplateTypeSettings(
  supabase: SupabaseClient,
  userId: string,
  templateTypeId: TemplateTypeId
) {
  const { data: defaults, error: defaultsErr } = await supabase
    .from('carousel_template_types')
    .select(
      'id, label, default_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
    )
    .eq('id', templateTypeId)
    .single();
  if (defaultsErr || !defaults) {
    throw new Error(defaultsErr?.message || 'Template type not found');
  }

  // Simplified behavior: "effective" == global defaults (shared across editor users).
  const effective = mergeTemplateTypeDefaults(defaults as TemplateTypeDefaultsRow, null);
  return { defaults, override: null, effective };
}


