import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type { CarouselTemplateDefinitionV1, TemplateTextAsset } from '@/lib/carousel-template-types';
import { getAuthedSupabase } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

function starterTemplateDefinition(): CarouselTemplateDefinitionV1 {
  const assets: TemplateTextAsset[] = [
    {
      id: 'display_name',
      type: 'text',
      kind: 'display_name',
      rect: { x: 140, y: 70, width: 500, height: 45 },
      text: 'Dr. Nick',
      style: { fontFamily: 'Inter', fontSize: 36, fontWeight: 'bold', fill: '#111827', textAlign: 'left' },
      locked: false,
      zIndex: 10,
      rotation: 0,
    },
    {
      id: 'handle',
      type: 'text',
      kind: 'handle',
      rect: { x: 140, y: 115, width: 500, height: 40 },
      text: '@drnick',
      style: { fontFamily: 'Inter', fontSize: 28, fontWeight: 'normal', fill: '#111827', textAlign: 'left' },
      locked: false,
      zIndex: 10,
      rotation: 0,
    },
    {
      id: 'cta_text',
      type: 'text',
      kind: 'cta_text',
      rect: { x: 780, y: 1320, width: 240, height: 60 },
      text: 'READ MORE',
      style: { fontFamily: 'Inter', fontSize: 28, fontWeight: 'normal', fill: '#111827', textAlign: 'left' },
      locked: false,
      zIndex: 10,
      rotation: 0,
    },
  ];

  return {
    template_version: 1,
    slides: [
      {
        slideIndex: 0,
        contentRegion: { x: 0, y: 0, width: 1080, height: 1440 },
        assets,
      },
    ],
    allowedFonts: [
      'Inter',
      'Poppins',
      'Montserrat',
      'Playfair Display',
      'Open Sans',
      'Noto Serif',
      'Droid Serif',
      'Noto Serif Condensed',
    ],
  };
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  // Must be an editor user.
  const { data: editorRow, error: editorErr } = await supabase
    .from('editor_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorErr || !editorRow?.user_id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // If user already has templates, do nothing.
  const { data: existingTpl } = await supabase
    .from('carousel_templates')
    .select('id')
    .eq('owner_user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (existingTpl && existingTpl.length > 0) {
    return NextResponse.json({ success: true, created: false });
  }

  // Create a starter template owned by this user.
  const def = starterTemplateDefinition();
  const { data: inserted, error: insErr } = await supabase
    .from('carousel_templates')
    .insert({
      name: 'Starter Template',
      owner_user_id: user.id,
      definition: def as any,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    return NextResponse.json({ success: false, error: insErr?.message || 'Failed to create starter template' }, { status: 500 });
  }

  const templateId = String(inserted.id);

  // Auto-map the starter template for both Regular and Enhanced.
  // This makes layout/realign usable immediately on first /editor open.
  await supabase
    .from('carousel_template_type_overrides')
    .upsert(
      [
        {
          user_id: user.id,
          template_type_id: 'regular',
          slide1_template_id_override: templateId,
          slide2_5_template_id_override: templateId,
          slide6_template_id_override: templateId,
        },
        {
          user_id: user.id,
          template_type_id: 'enhanced',
          slide1_template_id_override: templateId,
          slide2_5_template_id_override: templateId,
          slide6_template_id_override: templateId,
        },
      ],
      { onConflict: 'user_id,template_type_id' }
    );

  return NextResponse.json({ success: true, created: true, templateId });
}

