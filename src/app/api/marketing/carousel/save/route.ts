import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SaveCarouselRequest {
  id?: string; // If provided, updates existing. If null, creates new.
  title: string;
  headline: string;
  body: string;
  layoutJson: any; // VisionLayoutDecision
  imageBase64: string;
  imagePosition: { x: number; y: number; width: number; height: number };
  backgroundColor: string;
  textColor: string;
  headlineFontFamily?: string;
  bodyFontFamily?: string;
  customImagePrompt?: string;
  templateId?: string | null;
  templateSnapshot?: any | null;
}

interface SaveCarouselResponse {
  success: boolean;
  id?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  console.log('[Save API] 💾 ==================== SAVE CAROUSEL REQUEST ====================');

  // AUTH CHECK
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[Save API] ❌ Missing or invalid authorization header');
    return NextResponse.json({ success: false, error: 'Unauthorized' } as SaveCarouselResponse, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  console.log('[Save API] 🔐 Verifying user token...');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[Save API] ❌ Supabase environment variables not configured');
    return NextResponse.json({ success: false, error: 'Server configuration error' } as SaveCarouselResponse, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('[Save API] ❌ Invalid token or user not found:', userError?.message);
    return NextResponse.json({ success: false, error: 'Unauthorized' } as SaveCarouselResponse, { status: 401 });
  }

  console.log('[Save API] ✅ User authenticated:', user.email);

  // PARSE REQUEST BODY
  let body: SaveCarouselRequest;
  try {
    body = await request.json();
    console.log('[Save API] 📦 Request parsed');
    console.log('[Save API] 📝 Title:', body.title);
    console.log('[Save API] 🆔 Existing ID:', body.id || 'None (new save)');
  } catch (error) {
    console.error('[Save API] ❌ Failed to parse request body:', error);
    return NextResponse.json({ success: false, error: 'Invalid request body' } as SaveCarouselResponse, { status: 400 });
  }

  // VALIDATE
  if (!body.headline || !body.body || !body.layoutJson || !body.imageBase64 || !body.imagePosition) {
    console.error('[Save API] ❌ Missing required fields');
    return NextResponse.json({ success: false, error: 'Missing required fields' } as SaveCarouselResponse, { status: 400 });
  }

  try {
    if (body.id) {
      // UPDATE EXISTING CAROUSEL
      console.log('[Save API] 🔄 Updating existing carousel:', body.id);

      const { data, error } = await supabase
        .from('ai_carousels')
        .update({
          title: body.title,
          headline: body.headline,
          body: body.body,
          layout_json: body.layoutJson,
          image_base64: body.imageBase64,
          image_position: body.imagePosition,
          background_color: body.backgroundColor,
          text_color: body.textColor,
          headline_font_family: body.headlineFontFamily || null,
          body_font_family: body.bodyFontFamily || null,
          custom_image_prompt: body.customImagePrompt || null,
          template_id: body.templateId || null,
          template_snapshot: body.templateSnapshot || null,
        })
        .eq('id', body.id)
        .eq('user_id', user.id) // Ensure user owns this carousel
        .select('id')
        .single();

      if (error) {
        console.error('[Save API] ❌ Update failed:', error);
        return NextResponse.json({ success: false, error: error.message } as SaveCarouselResponse, { status: 500 });
      }

      console.log('[Save API] ✅ Carousel updated successfully');
      return NextResponse.json({ success: true, id: data.id } as SaveCarouselResponse);
    } else {
      // CREATE NEW CAROUSEL
      console.log('[Save API] ➕ Creating new carousel');

      const { data, error } = await supabase
        .from('ai_carousels')
        .insert({
          user_id: user.id,
          title: body.title,
          headline: body.headline,
          body: body.body,
          layout_json: body.layoutJson,
          image_base64: body.imageBase64,
          image_position: body.imagePosition,
          background_color: body.backgroundColor,
          text_color: body.textColor,
          headline_font_family: body.headlineFontFamily || null,
          body_font_family: body.bodyFontFamily || null,
          custom_image_prompt: body.customImagePrompt || null,
          template_id: body.templateId || null,
          template_snapshot: body.templateSnapshot || null,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[Save API] ❌ Insert failed:', error);
        return NextResponse.json({ success: false, error: error.message } as SaveCarouselResponse, { status: 500 });
      }

      console.log('[Save API] ✅ Carousel created successfully, ID:', data.id);
      return NextResponse.json({ success: true, id: data.id } as SaveCarouselResponse);
    }
  } catch (error) {
    console.error('[Save API] ❌ Save failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save carousel',
      } as SaveCarouselResponse,
      { status: 500 }
    );
  }
}

