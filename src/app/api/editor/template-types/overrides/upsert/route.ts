import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, type TemplateTypeId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  templateTypeId: TemplateTypeId;
  promptOverride?: string | null;
  emphasisPromptOverride?: string | null;
  imageGenPromptOverride?: string | null;
  slide1TemplateIdOverride?: string | null;
  slide2to5TemplateIdOverride?: string | null;
  slide6TemplateIdOverride?: string | null;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (body.templateTypeId !== 'regular' && body.templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  const patch: any = { user_id: user.id, template_type_id: body.templateTypeId };
  if (body.promptOverride !== undefined) patch.prompt_override = body.promptOverride;
  if (body.emphasisPromptOverride !== undefined) patch.emphasis_prompt_override = body.emphasisPromptOverride;
  if (body.imageGenPromptOverride !== undefined) patch.image_gen_prompt_override = body.imageGenPromptOverride;
  if (body.slide1TemplateIdOverride !== undefined) patch.slide1_template_id_override = body.slide1TemplateIdOverride;
  if (body.slide2to5TemplateIdOverride !== undefined) patch.slide2_5_template_id_override = body.slide2to5TemplateIdOverride;
  if (body.slide6TemplateIdOverride !== undefined) patch.slide6_template_id_override = body.slide6TemplateIdOverride;

  // Nothing to upsert
  if (Object.keys(patch).length <= 2) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_template_type_overrides')
    .upsert(patch, { onConflict: 'user_id,template_type_id' })
    .select(
      'user_id, template_type_id, prompt_override, emphasis_prompt_override, image_gen_prompt_override, slide1_template_id_override, slide2_5_template_id_override, slide6_template_id_override, updated_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, override: data });
}


