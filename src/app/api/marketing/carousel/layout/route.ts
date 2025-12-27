import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decideVisionBasedLayout } from '@/lib/claude-vision-layout';
import { generateMedicalImage, createMedicalImagePrompt } from '@/lib/gpt-image-generator';
import { CarouselTextRequest, LayoutResponse } from '@/lib/carousel-types';
import { wrapFlowLayout } from '@/lib/wrap-flow-layout';

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

    const includeImage = body.settings?.includeImage !== false; // Default to true
    let imageBase64: string | undefined;

    // STEP 1: Generate image with GPT-Image-1.5 (with native transparent background)
    console.log('[API] 🎨 ==================== IMAGE GENERATION START ====================');
    console.log('[API] 🎨 Image generation started with GPT-Image-1.5');
    console.log('[API] ✨ Native transparent background - no post-processing needed!');
    console.log('[API] 📝 Custom prompt provided?', !!body.settings?.imagePrompt);
    
    const imagePrompt = body.settings?.imagePrompt || createMedicalImagePrompt(body.headline.trim(), body.body.trim());
    console.log('[API] 📝 Final image prompt length:', imagePrompt.length, 'characters (max 32000)');
    
    try {
      const imageStartTime = Date.now();
      imageBase64 = await generateMedicalImage(imagePrompt);
      const imageElapsed = Date.now() - imageStartTime;
      
      console.log('[API] ✅ Image generated successfully with transparent background in', imageElapsed, 'ms');
      console.log('[API] 🔗 Image base64 length:', imageBase64.length, 'characters');
      console.log('[API] 📊 Image data type:', imageBase64.startsWith('data:image/png;base64,') ? 'base64 PNG with transparency' : 'unknown');
    } catch (error) {
      console.error('[API] ❌ Image generation failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        } as LayoutResponse,
        { status: 500 }
      );
    }
    console.log('[API] 🎨 ==================== IMAGE GENERATION END ====================');

    // STEP 2: If a template is selected, use deterministic wrap-flow inside contentRegion.
    // Otherwise fallback to Claude vision layout (legacy).
    let layout: any;
    if (body.templateId) {
      console.log('[API] 🧩 Template selected; using deterministic WRAP-FLOW inside template contentRegion');

      // Load template definition (RLS: readable for authenticated; this endpoint is admin-only anyway).
      const authedSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data: tpl, error: tplErr } = await authedSupabase
        .from('carousel_templates')
        .select('id, definition')
        .eq('id', body.templateId)
        .single();

      if (tplErr || !tpl?.definition) {
        console.error('[API] ❌ Failed to load template:', tplErr?.message);
        return NextResponse.json(
          { success: false, error: tplErr?.message || 'Failed to load template' } as LayoutResponse,
          { status: 400 }
        );
      }

      const def = tpl.definition as any;
      const slide0 = Array.isArray(def?.slides) ? def.slides.find((s: any) => s?.slideIndex === 0) || def.slides[0] : null;
      const region = slide0?.contentRegion;
      if (!region || typeof region.x !== 'number' || typeof region.y !== 'number' || typeof region.width !== 'number' || typeof region.height !== 'number') {
        console.error('[API] ❌ Template missing slides[0].contentRegion');
        return NextResponse.json(
          { success: false, error: 'Template is missing slide 1 contentRegion' } as LayoutResponse,
          { status: 400 }
        );
      }

      // Placement bounds = contentRegion inset by 40px (per aligned spec)
      const PAD = 40;
      const inset = {
        x: region.x + PAD,
        y: region.y + PAD,
        width: Math.max(1, region.width - (PAD * 2)),
        height: Math.max(1, region.height - (PAD * 2)),
      };

      // Deterministic initial image placement:
      // - square
      // - left-anchored
      // - size = 50% of OUTER contentRegion width (clamped to inset bounds)
      // - vertically centered within inset
      const desiredSize = region.width * 0.5;
      const size = Math.max(1, Math.min(desiredSize, inset.width, inset.height));
      const imagePosition = {
        x: inset.x,
        y: inset.y + (inset.height - size) / 2,
        width: size,
        height: size,
      };

      console.log('[API] 📐 Template imagePosition (deterministic):', imagePosition);

      const { layout: wrapLayout, meta } = wrapFlowLayout(
        body.headline.trim(),
        body.body.trim(),
        imagePosition,
        {
          contentRect: inset,
          clearancePx: 1,
          headlineFontSize: 76,
          bodyFontSize: 48,
          headlineMinFontSize: 56,
          bodyMinFontSize: 36,
          blockGapPx: 24,
          laneTieBreak: 'right',
          bodyPreferSideLane: true,
          minUsableLaneWidthPx: 300,
          skinnyLaneWidthPx: 380,
          minBelowSpacePx: 240,
        }
      );

      console.log('[API] 🧩 Wrap-flow meta:', meta);
      wrapLayout.image.url = imageBase64!;
      layout = wrapLayout;
    } else {
      // Legacy: deterministic templates not selected, keep Claude vision layout.
      // Position image in lower-middle portion to leave room for text above
      const imagePosition = {
        x: 290,      // Centered: (1080 - 500) / 2
        y: 850,      // Lower portion of 1440px canvas
        width: 500,  // Slightly smaller for more text space
        height: 500,
      };
      
      console.log('[API] 📐 Initial image position:', imagePosition);

      // STEP 3: Get vision-based layout from Claude
      console.log('[API] 🤖 ==================== CLAUDE VISION ANALYSIS START ====================');
      console.log('[API] 🤖 Calling Claude Vision API for layout decision...');
      console.log('[API] 📝 Headline:', body.headline.substring(0, 50) + '...');
      console.log('[API] 📝 Body:', body.body.substring(0, 50) + '...');
      
      layout = await decideVisionBasedLayout(
        body.headline.trim(),
        body.body.trim(),
        imageBase64!,
        imagePosition
      );
    }
    console.log('[API] ✅ Layout computed successfully');
    console.log('[API] 📊 Layout summary:', {
      textLinesCount: layout.textLines.length,
      hasImage: !!layout.image,
      imagePos: layout.image ? `(${layout.image.x}, ${layout.image.y})` : 'N/A',
    });
    
    // Log each text line for debugging
    layout.textLines.forEach((line, index) => {
      console.log(`[API] 📝 Line ${index + 1}:`, {
        text: line.text.substring(0, 40) + '...',
        size: line.baseSize,
        pos: `(${line.position.x}, ${line.position.y})`,
        stylesCount: line.styles.length,
      });
    });
    
    if (!body.templateId) {
      console.log('[API] 🤖 ==================== CLAUDE VISION ANALYSIS END ====================');
    }

    return NextResponse.json({
      success: true,
      layout,
      imageUrl: imageBase64,
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

