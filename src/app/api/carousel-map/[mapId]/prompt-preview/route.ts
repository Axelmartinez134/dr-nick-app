import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { loadEffectiveTemplateTypeSettings } from '@/app/api/editor/projects/_effective';
import {
  buildCarouselMapPromptPreview,
  getAuthedCarouselMapContext,
  isUuid,
  loadCarouselMapGraph,
} from '../../_lib';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Resp =
  | { success: true; fullPrompt: string; sections: Array<{ id: string; title: string; content: string }> }
  | { success: false; error: string };

export async function POST(request: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId, user } = auth;
    const { mapId } = await ctx.params;
    const id = String(mapId || '').trim();
    if (!id || !isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid mapId' } satisfies Resp, { status: 400 });

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const templateTypeId =
      body?.templateTypeId === 'regular'
        ? 'regular'
        : body?.templateTypeId === 'enhanced'
          ? 'enhanced'
          : body?.templateTypeId === 'html'
            ? 'html'
            : null;
    const savedPromptId = String(body?.savedPromptId || '').trim();
    const expansionId = String(body?.expansionId || '').trim();
    if (!templateTypeId) return NextResponse.json({ success: false, error: 'templateTypeId is required' } satisfies Resp, { status: 400 });
    const storedPromptTemplateTypeId = templateTypeId === 'enhanced' ? 'enhanced' : 'regular';
    if (!savedPromptId || !isUuid(savedPromptId)) return NextResponse.json({ success: false, error: 'savedPromptId is required' } satisfies Resp, { status: 400 });
    if (!expansionId || !isUuid(expansionId)) return NextResponse.json({ success: false, error: 'expansionId is required' } satisfies Resp, { status: 400 });

    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    const topic = graph.topics.find((row) => row.id === graph.selectedTopicId) || null;
    const expansion = graph.expansions.find((row) => row.id === expansionId) || null;
    if (!topic || !expansion) {
      return NextResponse.json({ success: false, error: 'Expansion not found' } satisfies Resp, { status: 404 });
    }

    const { data: promptRow, error: promptErr } = await supabase
      .from('editor_poppy_saved_prompts')
      .select('id, prompt, template_type_id')
      .eq('id', savedPromptId)
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', storedPromptTemplateTypeId)
      .maybeSingle();
    if (promptErr) throw new Error(promptErr.message);
    const stylePromptRaw = String((promptRow as any)?.prompt || '').trim();
    if (!stylePromptRaw) {
      return NextResponse.json({ success: false, error: 'Saved prompt is empty' } satisfies Resp, { status: 400 });
    }

    const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: user.id }, templateTypeId);
    const bestPracticesRaw = String((effective as any)?.bestPractices || '').trim();

    const preview = buildCarouselMapPromptPreview({
      stylePromptRaw,
      bestPracticesRaw,
      source: graph.source,
      topic,
      digestTopic: graph.digestTopic,
      expansion,
      templateTypeId,
    });

    return NextResponse.json({ success: true, fullPrompt: preview.fullPrompt, sections: preview.sections } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
