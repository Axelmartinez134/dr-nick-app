import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthedSupabase,
  resolveActiveAccountId,
  mergeTemplateTypeDefaults,
  type TemplateTypeDefaultsRow,
  type TemplateTypeId,
} from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  const { searchParams } = new URL(request.url);
  const templateTypeId = (searchParams.get('type') || '') as TemplateTypeId;
  if (templateTypeId !== 'regular' && templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  const { data: defaults, error: defaultsErr } = await supabase
    .from('carousel_template_types')
    .select(
      'id, label, default_prompt, default_emphasis_prompt, default_image_gen_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
    )
    .eq('id', templateTypeId)
    .single();
  if (defaultsErr || !defaults) {
    return NextResponse.json(
      { success: false, error: defaultsErr?.message || 'Template type not found' },
      { status: 404 }
    );
  }

  const { data: override, error: overrideErr } = await supabase
    .from('carousel_template_type_overrides')
    .select(
      'account_id, user_id, template_type_id, prompt_override, emphasis_prompt_override, image_gen_prompt_override, slide1_template_id_override, slide2_5_template_id_override, slide6_template_id_override, updated_at'
    )
    .eq('account_id', accountId)
    .eq('template_type_id', templateTypeId)
    .maybeSingle();
  // If override lookup fails, we treat it as "no override".
  const safeOverride = overrideErr ? null : (override as any);

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
      .eq('account_id', accountId);
    allowed = new Set((rows || []).map((r: any) => String(r.id)));
  }

  const effective = {
    ...effectiveRaw,
    slide1TemplateId: effectiveRaw.slide1TemplateId && allowed.has(effectiveRaw.slide1TemplateId) ? effectiveRaw.slide1TemplateId : null,
    slide2to5TemplateId:
      effectiveRaw.slide2to5TemplateId && allowed.has(effectiveRaw.slide2to5TemplateId) ? effectiveRaw.slide2to5TemplateId : null,
    slide6TemplateId: effectiveRaw.slide6TemplateId && allowed.has(effectiveRaw.slide6TemplateId) ? effectiveRaw.slide6TemplateId : null,
  };

  return NextResponse.json({
    success: true,
    defaults,
    override: safeOverride,
    effective,
  });
}


