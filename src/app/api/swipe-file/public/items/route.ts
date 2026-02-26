import 'server-only';

import { NextResponse } from 'next/server';
import { s } from '../../_utils';
import {
  normalizeSwipeUrlForInsert,
  normalizeTags,
  requireCaptureKeyFromRequest,
  requireServiceClient,
  resolveCaptureAccountContextFromKey,
} from '../_utils';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const k = String(body?.k || '').trim();
    const captureKey = requireCaptureKeyFromRequest(k);

    const urlRaw = s(body?.url);
    const categoryId = s(body?.categoryId);
    if (!urlRaw) throw new Error('url is required');
    if (!categoryId) throw new Error('categoryId is required');

    const tags = normalizeTags(body?.tags);
    const noteIn = typeof body?.note === 'string' ? String(body.note) : body?.note ?? null;
    const note = noteIn && typeof noteIn === 'string' ? String(noteIn).trim() || null : null;

    const svc = requireServiceClient();
    const { accountId, ownerUserId } = await resolveCaptureAccountContextFromKey(svc, captureKey);

    // Validate category belongs to capture account.
    const { data: catRow, error: catErr } = await svc
      .from('swipe_file_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (catErr) throw new Error(catErr.message);
    if (!catRow?.id) throw new Error('Invalid category');

    const { url, platform } = normalizeSwipeUrlForInsert(urlRaw);

    const { error } = await svc.from('swipe_file_items').insert({
      account_id: accountId,
      created_by_user_id: ownerUserId,
      url,
      platform,
      status: 'new',
      category_id: categoryId,
      tags,
      note,
      enrich_status: 'idle',
    } as any);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Save failed') }, { status: 401 });
  }
}

