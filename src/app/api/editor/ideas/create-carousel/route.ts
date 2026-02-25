import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId, type TemplateTypeId } from '../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../../projects/_effective';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  ideaId: string;
  templateTypeId: TemplateTypeId;
};

function sanitizePrompt(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging.
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

function buildInjectedPrompt(args: {
  basePrompt: string;
  audience: string;
  sourceTitle: string;
  sourceUrl: string;
  topicTitle: string;
  bullets: any;
}) {
  const topicJson = {
    title: String(args.topicTitle || ''),
    bullets: args.bullets ?? [],
  };
  const sourceJson = { sourceTitle: String(args.sourceTitle || ''), sourceUrl: String(args.sourceUrl || '') };

  const injected = `${String(args.basePrompt || '').trim()}

---
TOPIC_CONTEXT_JSON:
${JSON.stringify({ topic: topicJson, source: sourceJson, audience: String(args.audience || '') }, null, 2)}
---

INSTRUCTIONS:
- Generate a 6-slide carousel for this specific topic.
- Use the topic outline as the primary structure (you may refine wording, but keep claims grounded).
- Return your output in the exact format required by the prompt above.`;

  return sanitizePrompt(injected);
}

async function loadUserActivePoppyPromptForIdeas(args: {
  supabase: any;
  accountId: string;
  userId: string;
  templateTypeId: 'regular' | 'enhanced';
}) {
  const { supabase, accountId, userId, templateTypeId } = args;

  const { data: bestRow, error: bestErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .select('prompt, is_active, updated_at, created_at')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('template_type_id', templateTypeId)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!bestErr && bestRow) {
    const best = sanitizePrompt(String((bestRow as any)?.prompt || ''));
    if (best) return best;
  }

  const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: userId }, templateTypeId);
  return sanitizePrompt(String((effective as any)?.prompt || ''));
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const ideaId = String(body?.ideaId || '').trim();
  const templateTypeId = body?.templateTypeId === 'regular' ? 'regular' : body?.templateTypeId === 'enhanced' ? 'enhanced' : null;
  if (!ideaId) return NextResponse.json({ success: false, error: 'ideaId is required' }, { status: 400 });
  if (!templateTypeId) return NextResponse.json({ success: false, error: 'Invalid templateTypeId' }, { status: 400 });

  // Load idea (ownership enforced)
  const { data: idea, error: ideaErr } = await supabase
    .from('editor_ideas')
    .select('id, account_id, owner_user_id, source_id, title, bullets, status')
    .eq('id', ideaId)
    // Phase G: account-scoped ideas (shared within account).
    // Backwards-safe fallback for legacy rows.
    .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`)
    .maybeSingle();
  if (ideaErr) return NextResponse.json({ success: false, error: ideaErr.message }, { status: 500 });
  if (!idea) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });

  // Load source for metadata
  const { data: source, error: sourceErr } = await supabase
    .from('editor_idea_sources')
    .select('id, account_id, owner_user_id, source_title, source_url')
    .eq('id', (idea as any).source_id)
    // Phase G: account-scoped sources (shared within account).
    // Backwards-safe fallback for legacy rows.
    .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`)
    .maybeSingle();
  if (sourceErr) return NextResponse.json({ success: false, error: sourceErr.message }, { status: 500 });
  if (!source) return NextResponse.json({ success: false, error: 'Source not found' }, { status: 404 });

  // Load effective template-type settings (account-scoped) for template IDs.
  const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: user.id }, templateTypeId);

  // Per-account audience (used in injected prompt context JSON).
  const { data: audienceRow, error: audienceErr } = await supabase
    .from('editor_account_settings')
    .select('ideas_prompt_audience, brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (audienceErr) return NextResponse.json({ success: false, error: audienceErr.message }, { status: 500 });
  const audience = String((audienceRow as any)?.ideas_prompt_audience ?? '');

  const topicTitle = String((idea as any).title || '').trim() || 'Untitled Topic';
  const stylePrompt = await loadUserActivePoppyPromptForIdeas({ supabase, accountId, userId: user.id, templateTypeId });
  const brandVoiceRaw = String((audienceRow as any)?.brand_alignment_prompt_override ?? '');
  const basePrompt = sanitizePrompt(`BRAND_VOICE:\n${brandVoiceRaw}\n\nSTYLE_PROMPT:\n${stylePrompt}`);
  const promptRendered = buildInjectedPrompt({
    basePrompt,
    audience,
    sourceTitle: String((source as any).source_title || ''),
    sourceUrl: String((source as any).source_url || ''),
    topicTitle,
    bullets: (idea as any).bullets ?? [],
  });

  // Non-secret routing meta (board/chat/model) derived from the stored URL (no api_key).
  let poppyRoutingMeta: { boardId: string | null; chatId: string | null; model: string | null } = {
    boardId: null,
    chatId: null,
    model: null,
  };
  try {
    const { data: settingsRow } = await supabase
      .from('editor_account_settings')
      .select('poppy_conversation_url')
      .eq('account_id', accountId)
      .maybeSingle();
    const { data: editorRow } = await supabase
      .from('editor_users')
      .select('poppy_conversation_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const poppyConversationUrl =
      String((settingsRow as any)?.poppy_conversation_url || '').trim() ||
      String((editorRow as any)?.poppy_conversation_url || '').trim();
    if (poppyConversationUrl) {
      const u = new URL(poppyConversationUrl);
      poppyRoutingMeta = {
        boardId: String(u.searchParams.get('board_id') || '').trim() || null,
        chatId: String(u.searchParams.get('chat_id') || '').trim() || null,
        model: String(u.searchParams.get('model') || '').trim() || null,
      };
    }
  } catch {
    // ignore
  }

  // Create project with injected prompt_snapshot and template-type default templates.
  const nowIso = new Date().toISOString();
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .insert({
      account_id: accountId,
      owner_user_id: user.id,
      title: topicTitle,
      template_type_id: templateTypeId,
      caption: null,
      prompt_snapshot: promptRendered,
      slide1_template_id_snapshot: (effective as any)?.slide1TemplateId ?? null,
      slide2_5_template_id_snapshot: (effective as any)?.slide2to5TemplateId ?? null,
      slide6_template_id_snapshot: (effective as any)?.slide6TemplateId ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, title, template_type_id')
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Failed to create project' }, { status: 500 });
  }

  const slideRows = Array.from({ length: 6 }).map((_, slideIndex) => ({
    project_id: project.id,
    slide_index: slideIndex,
    headline: null,
    body: null,
    layout_snapshot: null,
    input_snapshot: null,
  }));
  const { error: slidesErr } = await supabase.from('carousel_project_slides').insert(slideRows);
  if (slidesErr) {
    await supabase.from('carousel_projects').delete().eq('id', project.id);
    return NextResponse.json({ success: false, error: slidesErr.message }, { status: 500 });
  }

  // Audit row (prompt_rendered + routing meta)
  await supabase.from('editor_idea_carousel_runs').insert({
    account_id: accountId,
    owner_user_id: user.id,
    idea_id: idea.id,
    source_id: source.id,
    project_id: project.id,
    template_type_id: templateTypeId,
    prompt_rendered: promptRendered,
    poppy_routing_meta: poppyRoutingMeta,
    created_at: nowIso,
  } as any);

  return NextResponse.json({
    success: true,
    project: { id: String(project.id), title: String(project.title), templateTypeId: String(project.template_type_id) },
    promptRendered,
    poppyRoutingMeta,
  });
}

