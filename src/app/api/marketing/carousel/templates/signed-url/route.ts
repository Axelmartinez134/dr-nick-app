import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

interface SignedUrlResponse {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateId = String(searchParams.get('templateId') || '');
  const path = String(searchParams.get('path') || '');
  const expiresIn = Math.min(60 * 60 * 24, Math.max(60, Number(searchParams.get('expiresIn') || 3600))); // 1 min .. 24h

  if (!templateId || !path) {
    return NextResponse.json({ success: false, error: 'Missing templateId or path' } as SignedUrlResponse, { status: 400 });
  }
  if (!path.startsWith(`${templateId}/assets/`)) {
    return NextResponse.json({ success: false, error: 'Invalid path' } as SignedUrlResponse, { status: 400 });
  }

  // Auth: any authenticated user (templates are readable for authenticated users).
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as SignedUrlResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as SignedUrlResponse, { status: 500 });
  }

  const verificationClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user }, error: userError } = await verificationClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as SignedUrlResponse, { status: 401 });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } as SignedUrlResponse,
      { status: 500 }
    );
  }

  // Sanity: ensure template exists (prevents signing random paths).
  const { data: tpl, error: tplErr } = await supabase
    .from('carousel_templates')
    .select('id')
    .eq('id', templateId)
    .single();
  if (tplErr || !tpl) {
    return NextResponse.json({ success: false, error: 'Template not found' } as SignedUrlResponse, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from('carousel-templates')
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create signed URL' } as SignedUrlResponse, { status: 400 });
  }

  return NextResponse.json({ success: true, signedUrl: data.signedUrl } as SignedUrlResponse);
}


