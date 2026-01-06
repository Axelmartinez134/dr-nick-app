import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface LoadCarouselResponse {
  success: boolean;
  carousel?: {
    id: string;
    title: string;
    headline: string;
    body: string;
    layoutJson: any;
    imageBase64: string;
    imagePosition: { x: number; y: number; width: number; height: number };
    backgroundColor: string;
    textColor: string;
    headlineFontFamily?: string;
    bodyFontFamily?: string;
    customImagePrompt?: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  console.log('[Load API] 📂 ==================== LOAD CAROUSEL REQUEST ====================');

  // Get carousel ID from query params
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    console.error('[Load API] ❌ Missing carousel ID');
    return NextResponse.json({ success: false, error: 'Carousel ID is required' } as LoadCarouselResponse, { status: 400 });
  }

  console.log('[Load API] 🆔 Loading carousel:', id);

  // AUTH CHECK
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[Load API] ❌ Missing or invalid authorization header');
    return NextResponse.json({ success: false, error: 'Unauthorized' } as LoadCarouselResponse, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  console.log('[Load API] 🔐 Verifying user token...');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[Load API] ❌ Supabase environment variables not configured');
    return NextResponse.json({ success: false, error: 'Server configuration error' } as LoadCarouselResponse, { status: 500 });
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
    console.error('[Load API] ❌ Invalid token or user not found:', userError?.message);
    return NextResponse.json({ success: false, error: 'Unauthorized' } as LoadCarouselResponse, { status: 401 });
  }

  console.log('[Load API] ✅ User authenticated:', user.email);

  try {
    console.log('[Load API] 📥 Fetching carousel from database...');

    const { data, error } = await supabase
      .from('ai_carousels')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this carousel
      .single();

    if (error) {
      console.error('[Load API] ❌ Query failed:', error);
      return NextResponse.json({ success: false, error: error.message } as LoadCarouselResponse, { status: 500 });
    }

    if (!data) {
      console.error('[Load API] ❌ Carousel not found');
      return NextResponse.json({ success: false, error: 'Carousel not found' } as LoadCarouselResponse, { status: 404 });
    }

    console.log('[Load API] ✅ Carousel loaded successfully');
    console.log('[Load API] 📝 Title:', data.title);

    const carousel = {
      id: data.id,
      title: data.title,
      headline: data.headline,
      body: data.body,
      layoutJson: data.layout_json,
      imageBase64: data.image_base64,
      imagePosition: data.image_position,
      backgroundColor: data.background_color,
      textColor: data.text_color,
      headlineFontFamily: (data as any).headline_font_family || undefined,
      bodyFontFamily: (data as any).body_font_family || undefined,
      customImagePrompt: data.custom_image_prompt,
      templateId: (data as any).template_id || null,
      templateSnapshot: (data as any).template_snapshot || null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ success: true, carousel } as LoadCarouselResponse);
  } catch (error) {
    console.error('[Load API] ❌ Load failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load carousel',
      } as LoadCarouselResponse,
      { status: 500 }
    );
  }
}

