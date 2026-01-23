import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../_utils';
import { generateMedicalImage } from '@/lib/gpt-image-generator';
import { generateGeminiImagePng } from '@/lib/gemini-image-generator';
import { computeAlphaMask128FromPngBytes } from '../../slides/image/_mask';
import { computeDefaultUploadedImagePlacement } from '@/lib/templatePlacement';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutes for image generation + RemoveBG

const BUCKET = 'carousel-project-images' as const;

function getPngDimensions(buf: Buffer | Uint8Array | null): { w: number; h: number } {
  try {
    if (!buf) return { w: 1, h: 1 };
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    // PNG signature (8 bytes)
    if (
      u8.length < 24 ||
      u8[0] !== 0x89 ||
      u8[1] !== 0x50 ||
      u8[2] !== 0x4e ||
      u8[3] !== 0x47 ||
      u8[4] !== 0x0d ||
      u8[5] !== 0x0a ||
      u8[6] !== 0x1a ||
      u8[7] !== 0x0a
    ) {
      return { w: 1, h: 1 };
    }
    // IHDR starts at byte 8, width/height are big-endian at bytes 16..23.
    const w = (u8[16]! << 24) | (u8[17]! << 16) | (u8[18]! << 8) | u8[19]!;
    const h = (u8[20]! << 24) | (u8[21]! << 16) | (u8[22]! << 8) | u8[23]!;
    const width = Math.max(1, Number(w) || 1);
    const height = Math.max(1, Number(h) || 1);
    return { w: width, h: height };
  } catch {
    return { w: 1, h: 1 };
  }
}

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
  imageConfig?: { aspectRatio?: string; imageSize?: string };
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
  debug?: any;
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
    .select(
      'id, owner_user_id, template_type_id, ai_image_autoremovebg_enabled, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot'
    )
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

  // Per-project setting: default ON.
  const aiImageAutoRemoveBgEnabled = (project as any)?.ai_image_autoremovebg_enabled !== false;

  // Enforce per-user model selection from DB (client cannot override).
  const { data: editorUserRow, error: editorUserErr } = await supabase
    .from('editor_users')
    .select('user_id, ai_image_gen_model')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorUserErr) {
    // Distinguish true auth/permission issues from schema/runtime problems (e.g. migration not applied).
    return NextResponse.json(
      {
        success: false,
        error: `Editor user lookup failed: ${editorUserErr.message}`,
      } as GenerateResponse,
      { status: 500 }
    );
  }
  if (!editorUserRow?.user_id) {
    return NextResponse.json({ success: false, error: 'Forbidden' } as GenerateResponse, { status: 403 });
  }
  const aiImageGenModel = String((editorUserRow as any)?.ai_image_gen_model || 'gpt-image-1.5').trim();

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
    const code = String((jobErr as any)?.code || '');
    console.error('[generate-ai-image] ❌ Failed to create job:', {
      code,
      message: (jobErr as any)?.message,
      details: (jobErr as any)?.details,
      hint: (jobErr as any)?.hint,
    });
    if (code === '23505') {
      return NextResponse.json(
        {
          success: false,
          error: `A generation job is already running for this slide (slide ${slideIndex + 1}). Please wait and try again.`,
          debug: { code, message: (jobErr as any)?.message },
        } as any,
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: (jobErr as any)?.message || 'Failed to create job',
        debug: { code, message: (jobErr as any)?.message, details: (jobErr as any)?.details, hint: (jobErr as any)?.hint },
      } as any,
      { status: 500 }
    );
  }

  const jobId = job.id as string;
  console.log('[generate-ai-image] 📋 Created job:', jobId);

  const baseDir = `projects/${projectId}/slides/${slideIndex}`.replace(/^\/+/, '');
  // NOTE: we ALWAYS store PNG in Supabase (even if the upstream model returned JPEG).
  const originalPath = `${baseDir}/ai-original.png`;
  const processedPath = `${baseDir}/ai-image.png`;
  const v = String(Date.now());

  let originalBuffer: Buffer | null = null;
  let original: GenerateResponse['original'] = undefined;

  try {
    // Step 1: Generate image using the per-user selected provider
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:generating' });
    // IMPORTANT: Send ONLY the user-provided prompt text (no hidden suffix).
    // Any constraints should live in the prompt generator / UI, not injected server-side.
    const noTextPrompt = String(prompt || '').trim();

    let sourceMimeType: 'image/png' | 'image/jpeg' = 'image/png';

    if (aiImageGenModel === 'gemini-3-pro-image-preview') {
      console.log('[generate-ai-image] 🎨 Calling Gemini image gen:', aiImageGenModel);
      const apiKey = String(process.env.GOOGLE_AI_API_KEY || '').trim();
      const aspectRatio = String((body as any)?.imageConfig?.aspectRatio || '3:4').trim();
      const imageSize = String((body as any)?.imageConfig?.imageSize || '1K').trim();
      const out = await generateGeminiImagePng({
        prompt: noTextPrompt,
        model: 'gemini-3-pro-image-preview',
        apiKey,
        imageConfig: { aspectRatio, imageSize },
      });
      const mime = String(out.mimeType || '').trim().toLowerCase();
      if (mime === 'image/jpeg' || mime === 'image/jpg') {
        sourceMimeType = 'image/jpeg';
      } else {
        sourceMimeType = 'image/png';
      }
      originalBuffer = out.bytes;
      console.log('[generate-ai-image] ✅ Gemini image generated:', {
        mimeType: out.mimeType,
        bytes: originalBuffer.length,
      });
    } else {
      // Default/fallback: OpenAI GPT Image
      console.log('[generate-ai-image] 🎨 Calling GPT-Image-1.5...');
      const dataUrl = await generateMedicalImage(noTextPrompt);

      // Extract base64 from data URL
      const base64Match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid image data returned from GPT-Image');
      }
      const imageBase64 = base64Match[1];
      sourceMimeType = 'image/png';
      originalBuffer = Buffer.from(imageBase64, 'base64');
      console.log('[generate-ai-image] ✅ GPT-Image generated, size:', originalBuffer.length, 'bytes');
    }

    // Normalize to PNG for all downstream handling + storage.
    // (This ensures "always store PNG" even when Gemini returns JPEG.)
    if (sourceMimeType !== 'image/png') {
      originalBuffer = await sharp(originalBuffer).png().toBuffer();
      sourceMimeType = 'image/png';
    }

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
    original = {
      bucket: BUCKET,
      path: originalPath,
      url: withVersion(origUrl.publicUrl, v),
      contentType: 'image/png',
    };
    console.log('[generate-ai-image] ✅ Original uploaded to storage');

    // Step 3: Run RemoveBG (optional per-project)
    const apiKey = String(process.env.REMOVEBG_API_KEY || '').trim();
    
    let processedBuffer: Buffer | null = null;
    let outMask: GenerateResponse['mask'] = undefined;
    let bgRemovalStatus: 'disabled' | 'succeeded' | 'failed' = aiImageAutoRemoveBgEnabled ? 'failed' : 'disabled';
    let processed: GenerateResponse['processed'] = undefined;
    let finalUrl = original.url;
    let finalPath = originalPath;
    let finalBufferForDims: Buffer | null = originalBuffer;

    if (aiImageAutoRemoveBgEnabled && apiKey) {
      try {
        await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:removebg' });
        console.log('[generate-ai-image] 🔄 Running RemoveBG...');
        const upstream = new FormData();
        upstream.append(
          'image_file',
          new Blob([originalBuffer], { type: 'image/png' }),
          'image.png'
        );
        upstream.append('format', 'png');

        const removeBgRes = await fetch('https://removebgapi.com/api/v1/remove', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });

        if (!removeBgRes.ok) {
          const errText = await removeBgRes.text().catch(() => '');
          console.warn('[generate-ai-image] ⚠️ RemoveBG failed:', removeBgRes.status, errText);
          // Fall back to the original PNG bytes.
        } else {
          processedBuffer = Buffer.from(await removeBgRes.arrayBuffer());
          console.log('[generate-ai-image] ✅ RemoveBG succeeded, size:', processedBuffer.length, 'bytes');

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
            finalBufferForDims = processedBuffer;
            bgRemovalStatus = 'succeeded';
            console.log('[generate-ai-image] ✅ Processed image uploaded to storage');
          }
        }
      } catch (bgErr: any) {
        console.warn('[generate-ai-image] ⚠️ RemoveBG error (falling back to original):', bgErr?.message);
        // Continue with original image as fallback
      }
    } else if (aiImageAutoRemoveBgEnabled && !apiKey) {
      console.warn('[generate-ai-image] ⚠️ No REMOVEBG_API_KEY, skipping background removal');
    }

    // Always compute alpha mask for text wrapping from the final PNG bytes.
    // - If BG removal is OFF, this will naturally be a full-opaque rectangular mask.
    // - If BG removal is ON but fails, we still provide a mask so text wrapping logic stays deterministic.
    outMask = computeAlphaMask128FromPngBytes(new Uint8Array(finalBufferForDims || originalBuffer), 32, 128, 128);

    // Persist the image to this slide's layout_snapshot server-side so reloads can't "lose" it.
    const templateIdForSlide =
      slideIndex === 0
        ? (project as any)?.slide1_template_id_snapshot
        : slideIndex === 5
          ? (project as any)?.slide6_template_id_snapshot
          : (project as any)?.slide2_5_template_id_snapshot;

    let templateSnapshot: any | null = null;
    if (templateIdForSlide) {
      const { data: tpl, error: tplErr } = await supabase
        .from('carousel_templates')
        .select('id, owner_user_id, definition')
        .eq('id', templateIdForSlide)
        .eq('owner_user_id', user.id)
        .maybeSingle();
      if (tplErr) {
        console.warn('[generate-ai-image] ⚠️ Failed to load template snapshot (falling back to default placement):', tplErr);
      } else {
        templateSnapshot = (tpl as any)?.definition || null;
      }
    }

    const dims = getPngDimensions(finalBufferForDims);
    const placement = computeDefaultUploadedImagePlacement(templateSnapshot, dims.w, dims.h);

    const { data: slideRow, error: slideErr } = await supabase
      .from('carousel_project_slides')
      .select('id, layout_snapshot')
      .eq('project_id', project.id)
      .eq('slide_index', slideIndex)
      .maybeSingle();
    if (slideErr || !slideRow?.id) {
      throw new Error('Slide not found (cannot persist AI image)');
    }

    const baseLayout =
      slideRow.layout_snapshot && typeof slideRow.layout_snapshot === 'object'
        ? { ...(slideRow.layout_snapshot as any) }
        : {};

    const nextLayoutSnapshot = {
      ...baseLayout,
      image: {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        url: finalUrl,
        storage: { bucket: BUCKET, path: finalPath },
        bgRemovalEnabled: !!aiImageAutoRemoveBgEnabled,
        bgRemovalStatus,
        ...(original ? { original: { url: original.url, storage: { bucket: original.bucket, path: original.path } } } : {}),
        ...(processed
          ? { processed: { url: processed.url, storage: { bucket: processed.bucket, path: processed.path } } }
          : {}),
        mask: outMask,
        isAiGenerated: true,
      },
    };

    const { error: upSlideErr } = await supabase
      .from('carousel_project_slides')
      .update({ layout_snapshot: nextLayoutSnapshot })
      .eq('id', slideRow.id);
    if (upSlideErr) {
      throw new Error(`Failed to persist AI image to slide: ${upSlideErr.message}`);
    }

    // Mark job as complete AFTER persistence succeeds.
    await completeJob(supabase, jobId, true);

    return NextResponse.json({
      success: true,
      jobId,
      bucket: BUCKET,
      path: finalPath,
      url: finalUrl,
      contentType: 'image/png',
      bgRemovalEnabled: !!aiImageAutoRemoveBgEnabled,
      bgRemovalStatus,
      mask: outMask,
      original,
      ...(processed ? { processed } : {}),
      debug: {
        // Debug only: show EXACT prompt sent to the upstream image model (no API keys).
        aiImageGenModel,
        aiImageAutoRemoveBgEnabled,
        promptSentToImageModel: noTextPrompt,
        imageConfigUsed: (body as any)?.imageConfig || null,
      },
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
