import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { realignTextLayout } from '@/lib/claude-vision-layout';
import { realignWithGemini } from '@/lib/gemini-vision-layout';
import { VisionLayoutDecision } from '@/lib/carousel-types';
import { getEmphasisStylesForLines } from '@/lib/gemini-intent-layout';
import { getEmphasisStylesForLinesClaude } from '@/lib/claude-emphasis-styles';
import { wrapFlowLayout } from '@/lib/wrap-flow-layout';

export const runtime = 'nodejs';
// NOTE: If deploying to a platform with hard serverless limits, this may be capped regardless.
// We raise this to allow longer Gemini waits when desired.
export const maxDuration = 180;

interface RealignRequest {
  headline: string;
  body: string;
  canvasScreenshot: string; // base64 PNG (not used for computational mode)
  imagePosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Optional client-measured font metrics (avg char width in em) to make wrap-flow robust across fonts.
  fontMetrics?: {
    headlineAvgCharWidthEm?: number;
    bodyAvgCharWidthEm?: number;
  };
  // Optional low-res alpha mask for the image (enables silhouette wrapping inside the contentRegion).
  imageAlphaMask?: { w: number; h: number; dataB64: string; alphaThreshold?: number };
  // Optional template contentRegion (outer), used to constrain deterministic wrap-flow.
  contentRegion?: { x: number; y: number; width: number; height: number };
  contentPadding?: number; // defaults to 40
  model?: 'claude' | 'gemini' | 'gemini-computational'; // Model selection
}

interface RealignResponse {
  success: boolean;
  layout?: VisionLayoutDecision;
  error?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Realign API] 🔄 ==================== REALIGNMENT REQUEST START ====================');
  console.log('[Realign API] ⏰ Start time:', new Date().toLocaleTimeString());

  // AUTH CHECK (same pattern as layout endpoint)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[Realign API] ❌ Missing or invalid authorization header');
    return NextResponse.json({ success: false, error: 'Unauthorized' } as RealignResponse, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  console.log('[Realign API] 🔐 Verifying user token...');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[Realign API] ❌ Supabase environment variables not configured');
    return NextResponse.json({ success: false, error: 'Server configuration error' } as RealignResponse, { status: 500 });
  }

  const verificationClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: { user }, error: userError } = await verificationClient.auth.getUser(token);

  if (userError || !user) {
    console.error('[Realign API] ❌ Invalid token or user not found:', userError?.message);
    return NextResponse.json({ success: false, error: 'Unauthorized' } as RealignResponse, { status: 401 });
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = !!(adminEmail && user.email === adminEmail);

  let isEditor = false;
  try {
    const authedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: editorRow } = await authedSupabase
      .from('editor_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    isEditor = !!editorRow?.user_id;
  } catch {
    isEditor = false;
  }

  if (!isAdmin && !isEditor) {
    console.error('[Realign API] ❌ Forbidden: user not admin and not editor allowlisted:', user.email);
    return NextResponse.json({ success: false, error: 'Forbidden' } as RealignResponse, { status: 403 });
  }

  console.log('[Realign API] ✅ User authenticated:', { email: user.email, isAdmin, isEditor });

  // PARSE REQUEST BODY
  let body: RealignRequest;
  try {
    body = await request.json();
    console.log('[Realign API] 📦 Request body parsed');
    console.log('[Realign API] 📝 Headline length:', body.headline?.length || 0);
    console.log('[Realign API] 📝 Body length:', body.body?.length || 0);
    console.log('[Realign API] 🖼️ Screenshot length:', body.canvasScreenshot?.length || 0);
    console.log('[Realign API] 📐 Image position:', JSON.stringify(body.imagePosition));
  } catch (error) {
    console.error('[Realign API] ❌ Failed to parse request body:', error);
    return NextResponse.json({ success: false, error: 'Invalid request body' } as RealignResponse, { status: 400 });
  }

  // VALIDATE INPUT
  const headlineTrimmed = (body.headline || '').trim();
  const bodyTrimmed = (body.body || '').trim();
  // Regular mode supports body-only copy. Realign should not hard-require a headline.
  if (!bodyTrimmed) {
    console.error('[Realign API] ❌ Missing required field: body');
    return NextResponse.json({ success: false, error: 'Body is required' } as RealignResponse, { status: 400 });
  }

  if (!body.canvasScreenshot || !body.canvasScreenshot.startsWith('data:image/png;base64,')) {
    console.error('[Realign API] ❌ Invalid canvas screenshot format');
    return NextResponse.json({ success: false, error: 'Canvas screenshot must be base64 PNG' } as RealignResponse, { status: 400 });
  }

  if (!body.imagePosition || typeof body.imagePosition.x !== 'number') {
    console.error('[Realign API] ❌ Invalid image position data');
    return NextResponse.json({ success: false, error: 'Valid image position is required' } as RealignResponse, { status: 400 });
  }

  console.log('[Realign API] ✅ Input validation passed');

  // Determine which model to use (default to computational)
  const selectedModel = body.model || 'gemini-computational';
  console.log('[Realign API] 🤖 Selected model:', selectedModel.toUpperCase());

  // CALL SELECTED AI MODEL FOR REALIGNMENT
  console.log(`[Realign API] 🤖 ==================== ${selectedModel.toUpperCase()} REALIGNMENT START ====================`);
  
  const modelDisplayName = 
    selectedModel === 'gemini-computational' ? 'Gemini 3 Intent-Based (Layout Engine)' :
    selectedModel === 'gemini' ? 'Gemini 3 Flash (Vision)' :
    'Claude (Wrap + Styles)';
  
  console.log(`[Realign API] 🧠 Sending to ${modelDisplayName} for text realignment...`);

  try {
    const realignStartTime = Date.now();
    
    let layout: VisionLayoutDecision;
    
    if (selectedModel === 'gemini-computational' || selectedModel === 'claude') {
      // Deterministic "Docs-style wrap" layout + single AI call for emphasis styles (never for placement).
      console.log(`[Realign API] 🏗️ Using WRAP-FLOW LAYOUT (NO OVERLAP) + ONE ${selectedModel === 'claude' ? 'CLAUDE' : 'GEMINI'} STYLES CALL`);

      const pad = typeof body.contentPadding === 'number' ? body.contentPadding : 40;
      const inset = body.contentRegion
        ? {
            x: body.contentRegion.x + pad,
            y: body.contentRegion.y + pad,
            width: Math.max(1, body.contentRegion.width - (pad * 2)),
            height: Math.max(1, body.contentRegion.height - (pad * 2)),
          }
        : null;

      const { layout: wrapLayout, meta } = wrapFlowLayout(
        headlineTrimmed,
        bodyTrimmed,
        body.imagePosition,
        {
          // If a template provides a contentRegion, we constrain layout to that inset rect.
          ...(inset ? { contentRect: inset } : { margin: 40 }),
          clearancePx: 1,
          lineHeight: 1.2,
          headlineFontSize: 76,
          bodyFontSize: 48,
          // Enforce carousel-friendly minimums (wrap/truncate before going smaller).
          headlineMinFontSize: 56,
          bodyMinFontSize: 36,
          blockGapPx: 24,
          laneTieBreak: 'right',
          bodyPreferSideLane: true,
          minUsableLaneWidthPx: 300,
          // If the image is short or lane is skinny, use space below instead of a tall narrow column.
          skinnyLaneWidthPx: 380,
          minBelowSpacePx: 240,
          headlineAvgCharWidthEm: (body as any)?.fontMetrics?.headlineAvgCharWidthEm,
          bodyAvgCharWidthEm: (body as any)?.fontMetrics?.bodyAvgCharWidthEm,
          imageAlphaMask: (body as any)?.imageAlphaMask,
        }
      );

      console.log('[Realign API] 🧩 Wrap-flow meta:', meta);
      console.log('[Realign API] 📊 Wrap-flow produced lines:', wrapLayout.textLines.length);

      console.log(`[Realign API] ✨ Step: Call ${selectedModel === 'claude' ? 'Claude' : 'Gemini'} ONCE for emphasis styles...`);
      try {
        const stylesByLine = selectedModel === 'claude'
          ? await getEmphasisStylesForLinesClaude(
              wrapLayout.textLines.map(l => ({ text: l.text })),
              { timeoutMs: 20_000, maxAttempts: 1 }
            )
          : await getEmphasisStylesForLines(
              wrapLayout.textLines.map(l => ({ text: l.text })),
              { timeoutMs: 120_000, maxAttempts: 1 }
            );
        wrapLayout.textLines.forEach((line: any, idx: number) => {
          line.styles = stylesByLine[idx] || [];
        });
        console.log('[Realign API] ✅ Styles applied');
      } catch (e) {
        console.warn('[Realign API] ⚠️ Styles call failed; continuing without emphasis styles:', e);
      }

      layout = wrapLayout as VisionLayoutDecision;
    } else if (selectedModel === 'gemini') {
      // Gemini with vision
      console.log('[Realign API] 👁️ Using Gemini VISION analysis');
      layout = await realignWithGemini(
        headlineTrimmed,
        bodyTrimmed,
        body.canvasScreenshot,
        body.imagePosition
      );
    } else {
      // Fallback (should be unreachable because 'claude' is handled above)
      console.log('[Realign API] 👁️ Using Claude VISION analysis (fallback)');
      layout = await realignTextLayout(body.headline.trim(), body.body.trim(), body.canvasScreenshot, body.imagePosition);
    }
    
    const realignElapsed = Date.now() - realignStartTime;

    console.log(`[Realign API] ✅ ${selectedModel.toUpperCase()} realignment completed in`, realignElapsed, 'ms');
    console.log('[Realign API] 📊 New text lines:', layout.textLines.length);
    console.log(`[Realign API] 🤖 ==================== ${selectedModel.toUpperCase()} REALIGNMENT END ====================`);

    const totalElapsed = Date.now() - startTime;
    console.log('[Realign API] ⏱️ Total API time:', totalElapsed, 'ms');
    console.log('[Realign API] 🔄 ==================== REALIGNMENT REQUEST END ====================');

    return NextResponse.json({
      success: true,
      layout,
    } as RealignResponse);
  } catch (error) {
    console.error('[Realign API] ❌ Realignment failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Realignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as RealignResponse,
      { status: 500 }
    );
  }
}

