import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { scrapeInstagramReelViaApify } from '@/app/api/editor/outreach/_apify';
import { canonicalizeInstagramUrl, getAuthedSwipeContext, isInstagramReelOrPostUrl } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 210;

type Resp = { success: true } | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, accountId } = auth;

  const { id } = await ctx.params;
  const itemId = String(id || '').trim();
  if (!itemId || !isUuid(itemId)) return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });

  // Load item (account-scoped)
  const { data: item, error: itemErr } = await supabase
    .from('swipe_file_items')
    .select('id, url, platform, enrich_status')
    .eq('id', itemId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
  if (!item?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  const platform = String((item as any)?.platform || 'unknown').trim();
  const urlRaw = String((item as any)?.url || '').trim();
  const url = platform === 'instagram' ? canonicalizeInstagramUrl(urlRaw) : urlRaw;
  if (platform !== 'instagram') {
    return NextResponse.json({ success: false, error: 'Enrichment V2 (Instagram-only in V1)' } satisfies Resp, { status: 400 });
  }
  if (!isInstagramReelOrPostUrl(url)) {
    return NextResponse.json({ success: false, error: 'Invalid Instagram Reel/Post URL' } satisfies Resp, { status: 400 });
  }

  // Mark running (best-effort; ignore if it fails).
  await supabase
    .from('swipe_file_items')
    .update({ enrich_status: 'running', enrich_error: null } as any)
    .eq('id', itemId)
    .eq('account_id', accountId);

  try {
    const scraped = await scrapeInstagramReelViaApify({ reelUrl: url, includeTranscript: true, includeDownloadedVideo: false });
    const caption = typeof (scraped as any)?.caption === 'string' ? String((scraped as any).caption || '').trim() : null;
    const transcript = typeof (scraped as any)?.transcript === 'string' ? String((scraped as any).transcript || '').trim() : null;
    const authorHandle =
      typeof (scraped as any)?.ownerUsername === 'string' ? String((scraped as any).ownerUsername || '').trim() || null : null;

    const nextStatus = transcript ? 'ok' : 'needs_transcript';

    const { error: upErr } = await supabase
      .from('swipe_file_items')
      .update({
        url,
        enrich_status: nextStatus,
        enrich_error: null,
        enriched_at: new Date().toISOString(),
        caption: caption || null,
        transcript: transcript || null,
        author_handle: authorHandle,
        raw_json: (scraped as any)?.raw ?? null,
      } as any)
      .eq('id', itemId)
      .eq('account_id', accountId);
    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || e || 'Enrich failed');
    await supabase
      .from('swipe_file_items')
      .update({ enrich_status: 'error', enrich_error: msg } as any)
      .eq('id', itemId)
      .eq('account_id', accountId);
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status: 500 });
  }
}

