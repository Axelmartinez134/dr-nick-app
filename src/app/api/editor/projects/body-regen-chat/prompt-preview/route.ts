import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';
import {
  buildBodyRegenContextText,
  buildBodyRegenSystemText,
  formatBodyRegenHistoryText,
  isUuid,
  loadBodyRegenContextOrThrow,
  loadBodyRegenMasterPrompt,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | {
      success: true;
      threadId: string | null;
      system: string;
      contextText: string;
      historyText: string;
    }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  try {
    const authed = await getAuthedSupabase(request);
    if (!authed.ok) {
      return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
    }
    const { supabase, user } = authed;

    const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
    if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
    const accountId = acct.accountId;

    const { searchParams } = new URL(request.url);
    const projectId = String(searchParams.get('projectId') || '').trim();
    const slideIndex = Number(searchParams.get('slideIndex'));
    if (!projectId || !isUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    }
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
      return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' } satisfies Resp, { status: 400 });
    }

    const ctx = await loadBodyRegenContextOrThrow({ supabase, accountId, projectId, slideIndex });
    const masterPrompt = await loadBodyRegenMasterPrompt({ supabase, accountId });

    const system = buildBodyRegenSystemText({ masterPrompt, slideIndex });
    const contextText = buildBodyRegenContextText({
      brandVoice: String(ctx.brandVoice || ''),
      projectTitle: String(ctx.project.title || ''),
      caption: String(ctx.project.caption || ''),
      slidesText: ctx.slidesText,
      attempts: ctx.attempts,
      swipeSource: ctx.swipeSource,
    });

    const { data: threadRow, error: threadErr } = await supabase
      .from('carousel_body_regen_chat_threads')
      .select('id')
      .eq('account_id', accountId)
      .eq('project_id', projectId)
      .eq('slide_index', slideIndex)
      .maybeSingle();
    if (threadErr) return NextResponse.json({ success: false, error: threadErr.message } satisfies Resp, { status: 500 });

    const threadId = String((threadRow as any)?.id || '').trim() || null;

    let historyText = '(none)';
    if (threadId) {
      const { data: historyRows, error: historyErr } = await supabase
        .from('carousel_body_regen_chat_messages')
        .select('role, content, created_at')
        .eq('account_id', accountId)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(24);
      if (historyErr) return NextResponse.json({ success: false, error: historyErr.message } satisfies Resp, { status: 500 });

      const history = (Array.isArray(historyRows) ? (historyRows as any[]) : [])
        .map((r) => ({
          role: String(r.role) === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: String(r.content || ''),
        }))
        .reverse();
      historyText = formatBodyRegenHistoryText(history);
    }

    return NextResponse.json({ success: true, threadId, system, contextText, historyText } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg.toLowerCase().includes('generate/realign first') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}
