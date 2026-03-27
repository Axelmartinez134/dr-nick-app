import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthedCarouselMapContext,
  loadAllCarouselMapPrompts,
} from '../_lib';
import type { CarouselMapPromptKey } from '../_types';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  promptKey?: CarouselMapPromptKey;
  promptText?: string | null;
};

function sanitizePromptInput(input: string): string {
  return String(input || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { supabase, accountId } = auth;
    const prompts = await loadAllCarouselMapPrompts({ supabase, accountId });
    return NextResponse.json({ success: true, prompts });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { supabase, accountId, user } = auth;

    let body: Body | null = null;
    try {
      body = (await request.json()) as Body;
    } catch {
      body = null;
    }
    const promptKey = body?.promptKey;
    const promptText = body?.promptText;
    if (promptKey !== 'topics' && promptKey !== 'opening_pairs' && promptKey !== 'expansions') {
      return NextResponse.json({ success: false, error: 'Invalid promptKey' }, { status: 400 });
    }
    const next = sanitizePromptInput(String(promptText ?? ''));
    if (next.length > 80_000) {
      return NextResponse.json({ success: false, error: 'promptText too long' }, { status: 400 });
    }

    const { error } = await supabase.from('editor_account_prompt_overrides').upsert(
      {
        account_id: accountId,
        surface: 'carousel_map',
        prompt_key: promptKey,
        prompt_text: next,
        created_by_user_id: user.id,
        updated_by_user_id: user.id,
      } as any,
      { onConflict: 'account_id,surface,prompt_key' }
    );
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const prompts = await loadAllCarouselMapPrompts({ supabase, accountId });
    return NextResponse.json({ success: true, prompts, promptKey, promptText: prompts[promptKey].promptText });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') }, { status: 500 });
  }
}
