import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type SuggestionOut = { id: string; idx: number; body: string; createdAt: string };
type MessageOut = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; suggestions?: SuggestionOut[] };

type Resp =
  | { success: true; threadId: string; messages: MessageOut[] }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

async function ensureThread(args: {
  supabase: any;
  accountId: string;
  userId: string;
  projectId: string;
  slideIndex: number;
}): Promise<string> {
  const { supabase, accountId, userId, projectId, slideIndex } = args;

  const { data: existing, error: exErr } = await supabase
    .from('carousel_body_regen_chat_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  const { data: inserted, error: insErr } = await supabase
    .from('carousel_body_regen_chat_threads')
    .insert({ account_id: accountId, project_id: projectId, slide_index: slideIndex, created_by_user_id: userId } as any)
    .select('id')
    .maybeSingle();
  if (insErr) {
    const code = (insErr as any)?.code;
    if (code !== '23505') throw new Error(insErr.message);
  }
  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  const { data: reread, error: rrErr } = await supabase
    .from('carousel_body_regen_chat_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .maybeSingle();
  if (rrErr) throw new Error(rrErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create body regen chat thread');
  return rereadId;
}

async function assertAllSlidesHaveTextLinesOrThrow(args: { supabase: any; projectId: string }) {
  const { supabase, projectId } = args;
  const { data: rows, error } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, layout_snapshot')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (error) throw new Error(error.message);
  if (!Array.isArray(rows) || rows.length !== 6) throw new Error('Could not load slides');
  for (const r of rows as any[]) {
    const snap = r?.layout_snapshot;
    const lines = snap && typeof snap === 'object' ? (snap as any).textLines : null;
    if (!Array.isArray(lines)) throw new Error('Generate/Realign first.');
  }
}

export async function GET(request: NextRequest) {
  try {
    const authed = await getAuthedSupabase(request);
    if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
    const { supabase, user } = authed;

    const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
    if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
    const accountId = acct.accountId;

    const { searchParams } = new URL(request.url);
    const projectId = String(searchParams.get('projectId') || '').trim();
    const slideIndex = Number(searchParams.get('slideIndex'));
    if (!projectId || !isUuid(projectId)) return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
      return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' } satisfies Resp, { status: 400 });
    }

    // Block chat until deterministic layout snapshots exist for all slides.
    await assertAllSlidesHaveTextLinesOrThrow({ supabase, projectId });

    const threadId = await ensureThread({ supabase, accountId, userId: user.id, projectId, slideIndex });

    const { data: msgRows, error: msgErr } = await supabase
      .from('carousel_body_regen_chat_messages')
      .select('id, role, content, created_at')
      .eq('account_id', accountId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (msgErr) return NextResponse.json({ success: false, error: msgErr.message } satisfies Resp, { status: 500 });

    const baseMsgs: MessageOut[] = Array.isArray(msgRows)
      ? (msgRows as any[])
          .map((r) => ({
            id: String(r.id),
            role: (String(r.role) === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: String(r.content || ''),
            createdAt: String(r.created_at || ''),
          }))
          .reverse()
      : [];

    const assistantIds = baseMsgs.filter((m) => m.role === 'assistant').map((m) => m.id);
    let suggestionsByMessageId: Record<string, SuggestionOut[]> = {};
    if (assistantIds.length) {
      const { data: sugRows, error: sugErr } = await supabase
        .from('carousel_body_regen_chat_suggestions')
        .select('id, source_message_id, idx, body, created_at')
        .eq('account_id', accountId)
        .eq('thread_id', threadId)
        .in('source_message_id', assistantIds);
      if (sugErr) return NextResponse.json({ success: false, error: sugErr.message } satisfies Resp, { status: 500 });
      suggestionsByMessageId = (Array.isArray(sugRows) ? sugRows : []).reduce((acc: any, r: any) => {
        const mid = String(r?.source_message_id || '').trim();
        if (!mid) return acc;
        const arr = acc[mid] || [];
        arr.push({
          id: String(r.id),
          idx: Number(r.idx),
          body: String(r.body || ''),
          createdAt: String(r.created_at || ''),
        });
        acc[mid] = arr;
        return acc;
      }, {} as Record<string, SuggestionOut[]>);
      // Stable ordering
      for (const k of Object.keys(suggestionsByMessageId)) {
        suggestionsByMessageId[k] = (suggestionsByMessageId[k] || []).slice().sort((a, b) => (a.idx - b.idx) || a.createdAt.localeCompare(b.createdAt));
      }
    }

    const out = baseMsgs.map((m) => (m.role === 'assistant' ? { ...m, suggestions: suggestionsByMessageId[m.id] || [] } : m));

    return NextResponse.json({ success: true, threadId, messages: out } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg.toLowerCase().includes('generate/realign first') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}

