import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decideTextLayout } from '@/lib/claude-text-layout';
import { CarouselTextRequest, LayoutResponse } from '@/lib/carousel-types';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] 🚀 Carousel layout request received');
    
    // Auth check: require Bearer token and admin email
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[API] ❌ No authorization header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as LayoutResponse,
        { status: 401 }
      );
    }

    console.log('[API] 🔐 Verifying authentication...');
    const token = authHeader.split(' ')[1];
    const verificationClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userError } = await verificationClient.auth.getUser(token);
    
    if (userError || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      console.log('[API] ❌ Auth failed:', userError?.message || 'Not admin');
      return NextResponse.json(
        { success: false, error: 'Forbidden' } as LayoutResponse,
        { status: 403 }
      );
    }

    console.log('[API] ✅ Authenticated as admin');

    // Parse and validate request body
    const body = await request.json() as CarouselTextRequest;
    console.log('[API] 📝 Request body:', {
      headlineLength: body.headline?.length,
      bodyLength: body.body?.length,
      backgroundColor: body.settings?.backgroundColor,
      textColor: body.settings?.textColor,
    });

    if (!body.headline || !body.headline.trim()) {
      console.log('[API] ❌ Missing headline');
      return NextResponse.json(
        { success: false, error: 'Headline is required' } as LayoutResponse,
        { status: 400 }
      );
    }

    if (!body.body || !body.body.trim()) {
      console.log('[API] ❌ Missing body');
      return NextResponse.json(
        { success: false, error: 'Body text is required' } as LayoutResponse,
        { status: 400 }
      );
    }

    // Get layout from Claude
    console.log('[API] 🤖 Calling Claude for layout decision...');
    const layout = await decideTextLayout(
      body.headline.trim(),
      body.body.trim()
    );

    console.log('[API] ✅ Layout received from Claude:', {
      headlinePos: `(${layout.headline.x}, ${layout.headline.y})`,
      bodyPos: `(${layout.body.x}, ${layout.body.y})`,
      headlineFontSize: layout.headline.fontSize,
      bodyFontSize: layout.body.fontSize,
    });

    return NextResponse.json({
      success: true,
      layout,
    } as LayoutResponse);
    
  } catch (error) {
    console.error('[API] ❌ Layout generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate layout',
      } as LayoutResponse,
      { status: 500 }
    );
  }
}

