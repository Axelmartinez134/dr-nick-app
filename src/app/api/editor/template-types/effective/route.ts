import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthedSupabase,
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
  const { supabase } = authed;

  const { searchParams } = new URL(request.url);
  const templateTypeId = (searchParams.get('type') || '') as TemplateTypeId;
  if (templateTypeId !== 'regular' && templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  const { data: defaults, error: defaultsErr } = await supabase
    .from('carousel_template_types')
    .select(
      'id, label, default_prompt, default_emphasis_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
    )
    .eq('id', templateTypeId)
    .single();
  if (defaultsErr || !defaults) {
    return NextResponse.json(
      { success: false, error: defaultsErr?.message || 'Template type not found' },
      { status: 404 }
    );
  }

  // Simplified behavior: "effective" == global defaults (shared across editor users).
  const effective = mergeTemplateTypeDefaults(defaults as TemplateTypeDefaultsRow, null);

  return NextResponse.json({
    success: true,
    defaults,
    override: null,
    effective,
  });
}


