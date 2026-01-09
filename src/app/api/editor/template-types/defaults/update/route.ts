import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, type TemplateTypeId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  templateTypeId: TemplateTypeId;
  defaultPrompt?: string;
  defaultEmphasisPrompt?: string;
  slide1TemplateId?: string | null;
  slide2to5TemplateId?: string | null;
  slide6TemplateId?: string | null;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (body.templateTypeId !== 'regular' && body.templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  const patch: any = {};
  if (typeof body.defaultPrompt === 'string') patch.default_prompt = body.defaultPrompt;
  if (typeof body.defaultEmphasisPrompt === 'string') patch.default_emphasis_prompt = body.defaultEmphasisPrompt;
  if (body.slide1TemplateId !== undefined) patch.default_slide1_template_id = body.slide1TemplateId;
  if (body.slide2to5TemplateId !== undefined) patch.default_slide2_5_template_id = body.slide2to5TemplateId;
  if (body.slide6TemplateId !== undefined) patch.default_slide6_template_id = body.slide6TemplateId;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_template_types')
    .update(patch)
    .eq('id', body.templateTypeId)
    .select(
      'id, label, default_prompt, default_emphasis_prompt, default_slide1_template_id, default_slide2_5_template_id, default_slide6_template_id, updated_at, updated_by'
    )
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, defaults: data });
}


