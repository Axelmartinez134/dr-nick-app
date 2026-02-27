import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s } from '../../../../_utils';
import { loadEffectiveTemplateTypeSettings } from '@/app/api/editor/projects/_effective';

export const runtime = 'nodejs';
export const maxDuration = 30;

type SectionOut = { id: string; title: string; content: string };

type Resp =
  | { success: true; fullPrompt: string; sections: SectionOut[] }
  | { success: false; error: string };

type Body = {
  templateTypeId: 'regular' | 'enhanced';
  savedPromptId: string;
  ideaId?: string | null;
  angleNotesSnapshot?: string | null;
};

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

function sanitizePrompt(input: string): string {
  // Match Generate Copy behavior: flatten control chars (including newlines) to spaces.
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

function schemaFor(templateTypeId: 'regular' | 'enhanced'): string {
  return templateTypeId === 'regular'
    ? `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- body must be a string (can be empty)\n- caption must be a string`
    : `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- headline/body must be strings (can be empty)\n- caption must be a string`;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, user, accountId } = auth;

    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }

    let body: Body | null = null;
    try {
      body = (await request.json()) as any;
    } catch {
      body = null;
    }

    const templateTypeId: 'regular' | 'enhanced' | null =
      (body as any)?.templateTypeId === 'regular'
        ? 'regular'
        : (body as any)?.templateTypeId === 'enhanced'
          ? 'enhanced'
          : null;
    const savedPromptId = s((body as any)?.savedPromptId);
    const ideaId = s((body as any)?.ideaId);
    const angleNotesSnapshotRaw = (body as any)?.angleNotesSnapshot;
    const angleNotesSnapshot =
      typeof angleNotesSnapshotRaw === 'string' ? String(angleNotesSnapshotRaw).trim() : angleNotesSnapshotRaw == null ? null : String(angleNotesSnapshotRaw).trim();

    if (!templateTypeId) return NextResponse.json({ success: false, error: 'templateTypeId is required' } satisfies Resp, { status: 400 });
    if (!savedPromptId || !isUuid(savedPromptId)) {
      return NextResponse.json({ success: false, error: 'savedPromptId is required' } satisfies Resp, { status: 400 });
    }
    if (ideaId && !isUuid(ideaId)) return NextResponse.json({ success: false, error: 'Invalid ideaId' } satisfies Resp, { status: 400 });

    const { data: item, error: itemErr } = await supabase
      .from('swipe_file_items')
      .select('id, caption, transcript, note')
      .eq('account_id', accountId)
      .eq('id', swipeItemId)
      .maybeSingle();
    if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
    if (!item?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

    const captionRaw = String((item as any)?.caption || '');
    const transcriptRaw = String((item as any)?.transcript || '');
    const noteRaw = String((item as any)?.note || '');

    const transcriptTrim = transcriptRaw.trim();
    if (!transcriptTrim) {
      return NextResponse.json({ success: false, error: 'Transcript missing. Enrich first.' } satisfies Resp, { status: 400 });
    }
    if (transcriptTrim.length > 25_000) {
      return NextResponse.json({ success: false, error: 'Transcript too long, can’t chat.' } satisfies Resp, { status: 400 });
    }

    // Load saved prompt snapshot (matches create-project behavior).
    const { data: promptRow, error: promptErr } = await supabase
      .from('editor_poppy_saved_prompts')
      .select('id, prompt, template_type_id')
      .eq('id', savedPromptId)
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', templateTypeId)
      .maybeSingle();
    if (promptErr) return NextResponse.json({ success: false, error: promptErr.message } satisfies Resp, { status: 500 });
    const stylePromptRaw = String((promptRow as any)?.prompt || '').trim();
    if (!stylePromptRaw) return NextResponse.json({ success: false, error: 'Saved prompt is empty' } satisfies Resp, { status: 400 });

    // Optional: load idea snapshot (matches create-project behavior).
    let swipeIdeaSnapshot = '';
    if (ideaId) {
      const { data: ideaRow, error: ideaErr } = await supabase
        .from('swipe_file_ideas')
        .select('id, title, slide_outline, angle_text')
        .eq('account_id', accountId)
        .eq('swipe_item_id', swipeItemId)
        .eq('id', ideaId)
        .maybeSingle();
      if (ideaErr) return NextResponse.json({ success: false, error: ideaErr.message } satisfies Resp, { status: 500 });
      const title = String((ideaRow as any)?.title || '').trim();
      const angleText = String((ideaRow as any)?.angle_text || '').trim();
      const outlineIn = (ideaRow as any)?.slide_outline;
      const slideOutline = Array.isArray(outlineIn) ? outlineIn.map((x: any) => String(x ?? '')).slice(0, 6) : [];
      if (!title || !angleText || slideOutline.length !== 6) {
        return NextResponse.json({ success: false, error: 'Idea not found' } satisfies Resp, { status: 404 });
      }
      swipeIdeaSnapshot = [
        `TITLE:\n${title}`,
        ``,
        `SLIDE_OUTLINE (6 slides):`,
        ...slideOutline.map((s, i) => `${i + 1}. ${String(s || '').trim()}`),
        ``,
        `ANGLE_TEXT:\n${angleText}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    // Effective template settings: best practices.
    const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: user.id }, templateTypeId);
    const bestPracticesRaw = String((effective as any)?.bestPractices || '').trim();

    // Compose primary instructions the same way Generate Copy does today for swipe-origin projects.
    const noteToUse = (typeof angleNotesSnapshot === 'string' ? angleNotesSnapshot : null) ?? noteRaw;
    const swipeAngleSnapshot = String(noteToUse || '').trim();

    const composedPromptRaw = swipeIdeaSnapshot
      ? [`SWIPE_SELECTED_IDEA:\n${swipeIdeaSnapshot}`].filter(Boolean).join('\n')
      : [
          `STYLE_PROMPT:\n${stylePromptRaw}`,
          swipeAngleSnapshot ? `\nSWIPE_ANGLE_NOTES:\n${swipeAngleSnapshot}` : ``,
        ]
          .filter(Boolean)
          .join('\n');

    const prompt = sanitizePrompt(composedPromptRaw);
    const best = sanitizePrompt(bestPracticesRaw);
    const caption = sanitizePrompt(captionRaw);
    const transcript = sanitizePrompt(transcriptTrim);
    if (!prompt) return NextResponse.json({ success: false, error: 'Primary instructions are empty' } satisfies Resp, { status: 400 });
    if (!transcript) return NextResponse.json({ success: false, error: 'Missing transcript after sanitization' } satisfies Resp, { status: 400 });

    const schema = schemaFor(templateTypeId);

    const introLines = [
      `You are an expert Instagram carousel copywriter.`,
      `You are given source material from an Instagram Reel (caption + transcript).`,
    ];

    const isSwipeSelectedIdea = String(composedPromptRaw || '').includes('SWIPE_SELECTED_IDEA:');
    const primaryHeader = isSwipeSelectedIdea
      ? 'PRIMARY INSTRUCTIONS: Create the carousel and enhance it from the generated Swipe Selected Idea.'
      : 'PRIMARY INSTRUCTIONS (user-provided "Poppy Prompt"):';
    const primary = `${primaryHeader}\n${prompt}`;
    const bestBlock = best ? `BEST PRACTICES (superadmin-only):\n${best}` : '';
    const source = `SOURCE MATERIAL:\nREEL_CAPTION:\n${caption || '(empty)'}\n\nREEL_TRANSCRIPT:\n${transcript}`;

    // Match the exact string we send in Generate Copy.
    const fullPrompt = [
      ...introLines,
      ``,
      primary,
      best ? `\n${bestBlock}` : ``,
      ``,
      source,
      ``,
      schema,
    ]
      .filter(Boolean)
      .join('\n');

    const sections: SectionOut[] = [
      { id: 'intro', title: 'Intro', content: introLines.join('\n') },
      { id: 'primary', title: 'Primary instructions', content: primary },
      ...(best ? [{ id: 'best_practices', title: 'Best practices', content: bestBlock }] : []),
      { id: 'source_material', title: 'Source material', content: source },
      { id: 'output_schema', title: 'Output schema', content: schema },
    ];

    return NextResponse.json({ success: true, fullPrompt, sections } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}

