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

  const authedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await authedClient.auth.getUser();
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

  const accountHeader = String(request.headers.get('x-account-id') || '').trim();

  if (accountHeader) {
    // Account-scoped: allow any account member to mint a signed URL for template assets in that account.
    const { data: mem, error: memErr } = await authedClient
      .from('editor_account_memberships')
      .select('id')
      .eq('account_id', accountHeader)
      .eq('user_id', user.id)
      .maybeSingle();
    if (memErr) {
      return NextResponse.json({ success: false, error: memErr.message } as SignedUrlResponse, { status: 500 });
    }
    if (!mem?.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' } as SignedUrlResponse, { status: 403 });
    }

    const { data: tpl, error: tplErr } = await supabase
      .from('carousel_templates')
      .select('id, account_id')
      .eq('id', templateId)
      .eq('account_id', accountHeader)
      .maybeSingle();
    if (tplErr || !tpl?.id) {
      return NextResponse.json({ success: false, error: 'Template not found' } as SignedUrlResponse, { status: 404 });
    }
  } else {
    // Legacy: ensure template exists and is owned by this user (templates are user-private).
    const { data: tpl, error: tplErr } = await supabase
      .from('carousel_templates')
      .select('id, owner_user_id')
      .eq('id', templateId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (tplErr || !tpl?.id) {
      return NextResponse.json({ success: false, error: 'Template not found' } as SignedUrlResponse, { status: 404 });
    }
  }

  const { data, error } = await supabase.storage
    .from('carousel-templates')
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create signed URL' } as SignedUrlResponse, { status: 400 });
  }

  return NextResponse.json({ success: true, signedUrl: data.signedUrl } as SignedUrlResponse);
}



