import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../_utils';
import { generateMedicalImage } from '@/lib/gpt-image-generator';
import { computeAlphaMask128FromPngBytes } from '../../slides/image/_mask';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for image generation + RemoveBG

const BUCKET = 'carousel-project-images' as const;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function withVersion(url: string, v: string) {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

type Body = {
  projectId: string;
  slideIndex: number;
  prompt: string;
};

type GenerateResponse = {
  success: boolean;
  bucket?: typeof BUCKET;
  path?: string;
  url?: string;
  contentType?: string;
  mask?: { w: number; h: number; dataB64: string; alphaThreshold: number };
  bgRemovalEnabled?: boolean;
  bgRemovalStatus?: 'disabled' | 'processing' | 'succeeded' | 'failed';
  original?: { bucket: typeof BUCKET; path: string; url: string; contentType: string };
  processed?: { bucket: typeof BUCKET; path: string; url: string; contentType: string };
  error?: string;
};

export async function POST(req: NextRequest) {
  console.log('[generate-ai-image] 🚀 Starting AI image generation...');

  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } as GenerateResponse, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } as GenerateResponse, { status: 400 });
  }

  const { projectId, slideIndex, prompt } = body;

  if (!projectId || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json(
      { success: false, error: 'Missing projectId or invalid slideIndex (0..5)' } as GenerateResponse,
      { status: 400 }
    );
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return NextResponse.json(
      { success: false, error: 'Prompt is required (min 10 characters)' } as GenerateResponse,
      { status: 400 }
    );
  }

  // Ownership check
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, template_type_id')
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (projErr || !project?.id) {
    return NextResponse.json({ success: false, error: 'Project not found' } as GenerateResponse, { status: 404 });
  }

  // Only Enhanced template type supports AI images
  if (project.template_type_id !== 'enhanced') {
    return NextResponse.json(
      { success: false, error: 'AI image generation is only available for Enhanced template type' } as GenerateResponse,
      { status: 400 }
    );
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env' } as GenerateResponse,
      { status: 500 }
    );
  }

  const baseDir = `projects/${projectId}/slides/${slideIndex}`.replace(/^\/+/, '');
  const originalPath = `${baseDir}/ai-original.png`;
  const processedPath = `${baseDir}/ai-image.png`;
  const v = String(Date.now());

  try {
    // Step 1: Generate image using GPT-Image-1.5
    console.log('[generate-ai-image] 🎨 Calling GPT-Image-1.5...');
    const dataUrl = await generateMedicalImage(prompt);
    
    // Extract base64 from data URL
    const base64Match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data returned from GPT-Image');
    }
    const imageBase64 = base64Match[1];
    const originalBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[generate-ai-image] ✅ GPT-Image generated, size:', originalBuffer.length, 'bytes');

    // Step 2: Upload original (for retries)
    const { error: upOrigErr } = await svc.storage.from(BUCKET).upload(originalPath, originalBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (upOrigErr) {
      throw new Error(`Failed to upload original: ${upOrigErr.message}`);
    }
    const { data: origUrl } = svc.storage.from(BUCKET).getPublicUrl(originalPath);
    const original = { bucket: BUCKET, path: originalPath, url: withVersion(origUrl.publicUrl, v), contentType: 'image/png' };
    console.log('[generate-ai-image] ✅ Original uploaded to storage');

    // Step 3: Run RemoveBG
    const apiKey = String(process.env.REMOVEBG_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('Server missing REMOVEBG_API_KEY');
    }

    console.log('[generate-ai-image] 🔄 Running RemoveBG...');
    const upstream = new FormData();
    upstream.append('image_file', new Blob([originalBuffer], { type: 'image/png' }), 'image.png');
    upstream.append('format', 'png');

    const removeBgRes = await fetch('https://removebgapi.com/api/v1/remove', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!removeBgRes.ok) {
      const errText = await removeBgRes.text().catch(() => '');
      throw new Error(`RemoveBG failed (${removeBgRes.status}): ${errText}`);
    }

    const processedBuffer = Buffer.from(await removeBgRes.arrayBuffer());
    console.log('[generate-ai-image] ✅ RemoveBG succeeded, size:', processedBuffer.length, 'bytes');

    // Step 4: Compute alpha mask for text wrapping
    const outMask = computeAlphaMask128FromPngBytes(new Uint8Array(processedBuffer), 32, 128, 128);
    console.log('[generate-ai-image] ✅ Alpha mask computed');

    // Step 5: Upload processed image
    const { error: upProcErr } = await svc.storage.from(BUCKET).upload(processedPath, processedBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (upProcErr) {
      throw new Error(`Failed to upload processed: ${upProcErr.message}`);
    }
    const { data: procUrl } = svc.storage.from(BUCKET).getPublicUrl(processedPath);
    const processed = { bucket: BUCKET, path: processedPath, url: withVersion(procUrl.publicUrl, v), contentType: 'image/png' };
    console.log('[generate-ai-image] ✅ Processed image uploaded to storage');

    return NextResponse.json({
      success: true,
      bucket: BUCKET,
      path: processedPath,
      url: processed.url,
      contentType: 'image/png',
      bgRemovalEnabled: true,
      bgRemovalStatus: 'succeeded',
      mask: outMask,
      original,
      processed,
    } as GenerateResponse);
  } catch (e: any) {
    console.error('[generate-ai-image] ❌ Error:', e?.message || e);
    return NextResponse.json(
      { success: false, error: e?.message || 'AI image generation failed' } as GenerateResponse,
      { status: 500 }
    );
  }
}
