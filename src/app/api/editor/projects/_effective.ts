import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mergeTemplateTypeDefaults,
  type TemplateTypeDefaultsRow,
  type TemplateTypeId,
} from '../_utils';

export async function loadEffectiveTemplateTypeSettings(
  supabase: SupabaseClient,
  args: { accountId: string; actorUserId: string },
  templateTypeId: TemplateTypeId
) {
  const [defaultsRes, overrideRes] = await Promise.all([
    supabase
      .from('carousel_template_types')
      .select(
        'id, label, default_prompt, default_emphasis_prompt, default_image_gen_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
      )
      .eq('id', templateTypeId)
      .single(),
    supabase
      .from('carousel_template_type_overrides')
      .select(
        'account_id, user_id, template_type_id, prompt_override, emphasis_prompt_override, image_gen_prompt_override, slide1_template_id_override, slide2_5_template_id_override, slide6_template_id_override, updated_at'
      )
      .eq('account_id', args.accountId)
      .eq('template_type_id', templateTypeId)
      .maybeSingle(),
  ]);

  const defaults = defaultsRes.data as any;
  const defaultsErr = defaultsRes.error as any;
  if (defaultsErr || !defaults) {
    throw new Error(defaultsErr?.message || 'Template type not found');
  }

  const safeOverride = overrideRes.error ? null : (overrideRes.data as any);

  const effectiveRaw = mergeTemplateTypeDefaults(defaults as TemplateTypeDefaultsRow, safeOverride);

  // Template IDs must belong to this account (templates are account-shared).
  const candidateIds = [
    effectiveRaw.slide1TemplateId,
    effectiveRaw.slide2to5TemplateId,
    effectiveRaw.slide6TemplateId,
  ].filter(Boolean) as string[];
  let allowed = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: rows } = await supabase
      .from('carousel_templates')
      .select('id')
      .in('id', candidateIds)
      .eq('account_id', args.accountId);
    allowed = new Set((rows || []).map((r: any) => String(r.id)));
  }

  const effective = {
    ...effectiveRaw,
    slide1TemplateId: effectiveRaw.slide1TemplateId && allowed.has(effectiveRaw.slide1TemplateId) ? effectiveRaw.slide1TemplateId : null,
    slide2to5TemplateId:
      effectiveRaw.slide2to5TemplateId && allowed.has(effectiveRaw.slide2to5TemplateId) ? effectiveRaw.slide2to5TemplateId : null,
    slide6TemplateId: effectiveRaw.slide6TemplateId && allowed.has(effectiveRaw.slide6TemplateId) ? effectiveRaw.slide6TemplateId : null,
  };

  return { defaults, override: safeOverride, effective };
}


