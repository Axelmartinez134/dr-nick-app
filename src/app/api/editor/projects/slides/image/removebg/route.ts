import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../../_utils';
import { computeAlphaMask128FromPngBytes } from '../_mask';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Resp =
  | {
      success: true;
      processedContentType: string;
      processedPngB64: string;
      mask: { w: number; h: number; dataB64: string; alphaThreshold: number };
      meta: {
        requestId?: string;
        processingTimeMs?: number;
        imageWidth?: number;
        imageHeight?: number;
      };
    }
  | { success: false; error: string; statusCode?: number };

function binToB64(u8: Uint8Array) {
  return Buffer.from(u8).toString('base64');
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error, statusCode: authed.status } satisfies Resp, {
      status: authed.status,
    });
  }

  const apiKey = String(process.env.REMOVEBG_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Server missing REMOVEBG_API_KEY' } satisfies Resp, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: 'Missing file' } satisfies Resp, { status: 400 });
  }

  // Enforce same constraints as upload: JPG/PNG/WebP only, 10MB
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const t = String((file as any)?.type || '');
  if (!allowedTypes.has(t)) {
    return NextResponse.json({ success: false, error: 'Unsupported file type (jpg/png/webp only)' } satisfies Resp, { status: 400 });
  }
  if (Number((file as any)?.size || 0) > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'File too large (max 10MB)' } satisfies Resp, { status: 400 });
  }

  // Forward to removebgapi.com (sync binary response)
  const upstream = new FormData();
  // Poof API compatibility: send both `image_file` and `file`.
  upstream.append('image_file', file);
  upstream.append('file', file);
  upstream.append('format', 'png');

  const r = await fetch('https://api.poof.bg/v1/remove', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: upstream,
  });
  try {
    if (r.redirected || (r.status >= 300 && r.status < 400)) {
      console.warn('[removebg] upstream redirect/status', {
        status: r.status,
        redirected: r.redirected,
        url: r.url,
        location: r.headers.get('location'),
      });
    }
  } catch {
    // ignore
  }

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    const msg = `RemoveBG failed (${r.status})${errText ? `: ${errText.slice(0, 300)}` : ''}`;
    return NextResponse.json({ success: false, error: msg, statusCode: r.status } satisfies Resp, { status: 400 });
  }

  const contentType = r.headers.get('content-type') || 'image/png';
  const requestId = r.headers.get('x-request-id') || undefined;
  const processingTimeMs = Number(r.headers.get('x-processing-time-ms') || '') || undefined;
  const imageWidth = Number(r.headers.get('x-image-width') || '') || undefined;
  const imageHeight = Number(r.headers.get('x-image-height') || '') || undefined;

  const ab = await r.arrayBuffer();
  const bytes = new Uint8Array(ab);

  // RemoveBG returns an image with alpha; compute our 128×128 occupancy mask server-side.
  // NOTE: We compute from the processed PNG bytes so client never needs to read pixels (avoids CORS taint).
  const mask = computeAlphaMask128FromPngBytes(bytes, 32, 128, 128);

  return NextResponse.json(
    {
      success: true,
      processedContentType: contentType,
      processedPngB64: binToB64(bytes),
      mask,
      meta: { requestId, processingTimeMs, imageWidth, imageHeight },
    } satisfies Resp,
    { status: 200 }
  );
}

