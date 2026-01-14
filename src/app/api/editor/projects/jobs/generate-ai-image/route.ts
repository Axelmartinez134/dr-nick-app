import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../_utils';
import { generateMedicalImage } from '@/lib/gpt-image-generator';
import { computeAlphaMask128FromPngBytes } from '../../slides/image/_mask';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutes for image generation + RemoveBG

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

async function updateJobProgress(
  supabase: any,
  jobId: string,
  patch: { status?: string; error?: string | null }
) {
  try {
    const dbPatch: any = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.error !== undefined) dbPatch.error = patch.error;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase.from('carousel_generation_jobs').update(dbPatch).eq('id', jobId);
  } catch (e) {
    console.warn('[generate-ai-image] ⚠️ Failed to update job progress:', e);
  }
}

async function completeJob(supabase: any, jobId: string, success: boolean, errorMsg?: string) {
  try {
    await supabase
      .from('carousel_generation_jobs')
      .update({
        status: success ? 'completed' : 'failed',
        error: success ? null : (errorMsg || 'Unknown error'),
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (e) {
    console.warn('[generate-ai-image] ⚠️ Failed to complete job:', e);
  }
}

type Body = {
  projectId: string;
  slideIndex: number;
  prompt: string;
};

type GenerateResponse = {
  success: boolean;
  jobId?: string;
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

  // Create job entry for tracking progress
  const { data: job, error: jobErr } = await supabase
    .from('carousel_generation_jobs')
    .insert({
      project_id: project.id,
      template_type_id: 'enhanced',
      job_type: 'generate-ai-image',
      slide_index: slideIndex,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (jobErr) {
    console.error('[generate-ai-image] ❌ Failed to create job:', jobErr);
    return NextResponse.json({ success: false, error: 'Failed to create job' } as GenerateResponse, { status: 500 });
  }

  const jobId = job.id as string;
  console.log('[generate-ai-image] 📋 Created job:', jobId);

  const baseDir = `projects/${projectId}/slides/${slideIndex}`.replace(/^\/+/, '');
  const originalPath = `${baseDir}/ai-original.png`;
  const processedPath = `${baseDir}/ai-image.png`;
  const v = String(Date.now());

  let originalBuffer: Buffer | null = null;
  let original: GenerateResponse['original'] = undefined;

  try {
    // Step 1: Generate image using GPT-Image-1.5
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:generating' });
    console.log('[generate-ai-image] 🎨 Calling GPT-Image-1.5...');
    const dataUrl = await generateMedicalImage(prompt);
    
    // Extract base64 from data URL
    const base64Match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data returned from GPT-Image');
    }
    const imageBase64 = base64Match[1];
    originalBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[generate-ai-image] ✅ GPT-Image generated, size:', originalBuffer.length, 'bytes');

    // Step 2: Upload original (for retries and fallback)
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:uploading-original' });
    const { error: upOrigErr } = await svc.storage.from(BUCKET).upload(originalPath, originalBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (upOrigErr) {
      throw new Error(`Failed to upload original: ${upOrigErr.message}`);
    }
    const { data: origUrl } = svc.storage.from(BUCKET).getPublicUrl(originalPath);
    original = { bucket: BUCKET, path: originalPath, url: withVersion(origUrl.publicUrl, v), contentType: 'image/png' };
    console.log('[generate-ai-image] ✅ Original uploaded to storage');

    // Step 3: Run RemoveBG (with fallback)
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:removebg' });
    const apiKey = String(process.env.REMOVEBG_API_KEY || '').trim();
    
    let processedBuffer: Buffer | null = null;
    let outMask: GenerateResponse['mask'] = undefined;
    let bgRemovalStatus: 'succeeded' | 'failed' = 'failed';
    let processed: GenerateResponse['processed'] = undefined;
    let finalUrl = original.url;
    let finalPath = originalPath;

    if (apiKey) {
      try {
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
          console.warn('[generate-ai-image] ⚠️ RemoveBG failed:', removeBgRes.status, errText);
          // Don't throw - fall back to original image
        } else {
          processedBuffer = Buffer.from(await removeBgRes.arrayBuffer());
          console.log('[generate-ai-image] ✅ RemoveBG succeeded, size:', processedBuffer.length, 'bytes');

          // Compute alpha mask for text wrapping
          outMask = computeAlphaMask128FromPngBytes(new Uint8Array(processedBuffer), 32, 128, 128);
          console.log('[generate-ai-image] ✅ Alpha mask computed');

          // Upload processed image
          await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:uploading' });
          const { error: upProcErr } = await svc.storage.from(BUCKET).upload(processedPath, processedBuffer, {
            contentType: 'image/png',
            upsert: true,
          });
          if (upProcErr) {
            console.warn('[generate-ai-image] ⚠️ Failed to upload processed:', upProcErr.message);
            // Fall back to original
          } else {
            const { data: procUrl } = svc.storage.from(BUCKET).getPublicUrl(processedPath);
            processed = { bucket: BUCKET, path: processedPath, url: withVersion(procUrl.publicUrl, v), contentType: 'image/png' };
            finalUrl = processed.url;
            finalPath = processedPath;
            bgRemovalStatus = 'succeeded';
            console.log('[generate-ai-image] ✅ Processed image uploaded to storage');
          }
        }
      } catch (bgErr: any) {
        console.warn('[generate-ai-image] ⚠️ RemoveBG error (falling back to original):', bgErr?.message);
        // Continue with original image as fallback
      }
    } else {
      console.warn('[generate-ai-image] ⚠️ No REMOVEBG_API_KEY, skipping background removal');
    }

    // Mark job as complete
    await completeJob(supabase, jobId, true);

    return NextResponse.json({
      success: true,
      jobId,
      bucket: BUCKET,
      path: finalPath,
      url: finalUrl,
      contentType: 'image/png',
      bgRemovalEnabled: true,
      bgRemovalStatus,
      ...(outMask ? { mask: outMask } : {}),
      original,
      ...(processed ? { processed } : {}),
    } as GenerateResponse);
  } catch (e: any) {
    console.error('[generate-ai-image] ❌ Error:', e?.message || e);
    await completeJob(supabase, jobId, false, e?.message || 'AI image generation failed');
    return NextResponse.json(
      { success: false, jobId, error: e?.message || 'AI image generation failed' } as GenerateResponse,
      { status: 500 }
    );
  }
}
