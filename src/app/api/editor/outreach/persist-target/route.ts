import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveAccountIdHeader, getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  instagramUrl: string;
  fullName: string | null;
  username: string | null;
  profilePicUrlHD: string | null;
  rawJson: any;
  baseTemplateId: string | null;
  createdTemplateId: string | null;
  createdProjectId: string | null;
  // Optional: Reel/Post source fields (Phase: Reel outreach)
  sourcePostUrl?: string | null;
  sourcePostShortcode?: string | null;
  sourcePostCaption?: string | null;
  sourcePostTranscript?: string | null;
  sourcePostRawJson?: any;
  sourcePostScrapedAt?: string | null;
};

type Resp =
  | { success: true; id: string }
  | { success: false; error: string };

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

async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

function s(v: any): string | null {
  const out = typeof v === 'string' ? v.trim() : '';
  return out ? out : null;
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const instagramUrl = s(body?.instagramUrl);
  if (!instagramUrl) {
    return NextResponse.json({ success: false, error: 'instagramUrl is required' } satisfies Resp, { status: 400 });
  }

  const createdProjectId = s(body?.createdProjectId);
  const createdTemplateId = s(body?.createdTemplateId);
  if (!createdProjectId || !createdTemplateId) {
    return NextResponse.json(
      { success: false, error: 'createdProjectId and createdTemplateId are required' } satisfies Resp,
      { status: 400 }
    );
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  const accountId = getActiveAccountIdHeader(request);

  const row = {
    created_by_user_id: user.id,
    account_id: accountId,
    instagram_url: instagramUrl,
    full_name: s(body?.fullName),
    username: s(body?.username),
    profile_pic_url_hd: s(body?.profilePicUrlHD),
    raw_json: body?.rawJson ?? null,
    base_template_id: s(body?.baseTemplateId),
    created_template_id: createdTemplateId,
    created_project_id: createdProjectId,
    source_post_url: s((body as any)?.sourcePostUrl),
    source_post_shortcode: s((body as any)?.sourcePostShortcode),
    source_post_caption: s((body as any)?.sourcePostCaption),
    source_post_transcript: s((body as any)?.sourcePostTranscript),
    source_post_raw_json: (body as any)?.sourcePostRawJson ?? null,
    source_post_scraped_at: s((body as any)?.sourcePostScrapedAt),
  };

  const { data: inserted, error } = await svc.from('editor_outreach_targets').insert(row as any).select('id').single();
  if (error || !inserted?.id) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to persist outreach record' } satisfies Resp, { status: 500 });
  }

  return NextResponse.json({ success: true, id: String(inserted.id) } satisfies Resp);
}

