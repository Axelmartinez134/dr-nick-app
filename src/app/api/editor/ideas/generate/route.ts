import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Body = {
  sourceTitle: string;
  sourceUrl: string;
  topicCount?: number;
};

type BulletGroup = { heading: string; points: string[] };
type TopicOut = { title: string; bullets: BulletGroup[] };

const DEFAULT_IDEAS_PROMPT = `Review the social media post(s) in your knowledge base and extract {{topicCount}} topic ideas that would be interesting to an audience of {{audience}}.

Context:
- Source title: {{sourceTitle}}
- Source url: {{sourceUrl}}

For each topic, provide:
- A concise title
- 3–6 bullet groups. Each bullet group has:
  - a heading (e.g. "Key Point", "Business Impact", "Opportunity", "Action Item")
  - 1–3 short points

Do not write the carousel copy yet. Only identify topic ideas and their outlines.`;

function sanitizeText(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging.
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    const token = `{{${k}}}`;
    out = out.split(token).join(String(v ?? ''));
  }
  return sanitizeText(out);
}

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Parser did not return JSON');
  }
  const raw = s.slice(first, last + 1);
  return JSON.parse(raw);
}

function assertValidIdeasPayload(payload: any, topicCount: number) {
  const topics = payload?.topics;
  if (!Array.isArray(topics) || topics.length !== topicCount) {
    throw new Error(`Invalid parser output: topics must be an array of length ${topicCount}`);
  }
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    if (!t || typeof t !== 'object') throw new Error(`Invalid topic ${i + 1}: must be an object`);
    if (typeof t.title !== 'string' || !String(t.title).trim()) throw new Error(`Invalid topic ${i + 1}: title must be a string`);
    if (!Array.isArray(t.bullets)) throw new Error(`Invalid topic ${i + 1}: bullets must be an array`);
    for (let b = 0; b < t.bullets.length; b++) {
      const g = t.bullets[b];
      if (!g || typeof g !== 'object') throw new Error(`Invalid topic ${i + 1} bullet group ${b + 1}: must be an object`);
      if (typeof g.heading !== 'string' || !String(g.heading).trim()) {
        throw new Error(`Invalid topic ${i + 1} bullet group ${b + 1}: heading must be a string`);
      }
      if (!Array.isArray(g.points)) throw new Error(`Invalid topic ${i + 1} bullet group ${b + 1}: points must be an array`);
      for (const p of g.points) {
        if (typeof p !== 'string') throw new Error(`Invalid topic ${i + 1} bullet group ${b + 1}: point must be a string`);
      }
    }
  }
}

async function callPoppy(prompt: string, args: { poppyConversationUrl: string }) {
  const baseUrl = String(args?.poppyConversationUrl || '').trim();
  const apiKey = process.env.POPPY_API_KEY;
  if (!baseUrl) throw new Error('Missing poppy_conversation_url for this user');
  if (!apiKey) throw new Error('Missing env var: POPPY_API_KEY');

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      'Invalid poppy_conversation_url for this user. It must be a full https URL like ' +
        '"https://api.getpoppy.ai/api/conversation?board_id=...&chat_id=...&model=...".'
    );
  }
  // Always enforce api_key from server env (never rely on stored URL).
  url.searchParams.set('api_key', apiKey);

  // Per spec: model comes from the stored URL.
  const modelFromUrl = String(url.searchParams.get('model') || '').trim();

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 90_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelFromUrl ? { prompt, model: modelFromUrl } : { prompt }),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Poppy error (${res.status}): ${text.slice(0, 500)}`);
    }
    return { rawText: text, model: modelFromUrl || null };
  } finally {
    clearTimeout(t);
  }
}

async function callAnthropicParseIdeas(opts: { rawToParse: string; topicCount: number }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  const schema = `Return ONLY valid JSON in this exact shape:
{
  "topics": [
    {
      "title": "...",
      "bullets": [
        { "heading": "Key Point", "points": ["...", "..."] }
      ]
    }
  ]
}

Rules (HARD):
- topics must be length ${opts.topicCount}
- title must be a string
- bullets must be an array (can be empty)
- Each bullet group must be { heading: string, points: string[] }
- points must be strings (can be empty strings but prefer meaningful)
- Return JSON only (no markdown)`;

  const userText = `${schema}\n\nData to structure:\n${opts.rawToParse}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 90_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: 'user', content: userText }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic error (${res.status}): ${msg}`);
    }
    const content0 = json?.content?.[0];
    const text = content0?.text || '';
    return { rawText: text, model };
  } finally {
    clearTimeout(t);
  }
}

async function updateRunProgress(
  supabase: any,
  args: { runId: string; accountId: string; userId: string },
  patch: { status?: string; error?: string | null }
) {
  try {
    const dbPatch: any = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.error !== undefined) dbPatch.error = patch.error;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase
      .from('editor_idea_runs')
      .update(dbPatch)
      .eq('id', args.runId)
      .or(`account_id.eq.${args.accountId},and(account_id.is.null,owner_user_id.eq.${args.userId})`);
  } catch {
    // best-effort only
  }
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

  const sourceTitle = String(body?.sourceTitle || '').trim();
  const sourceUrl = String(body?.sourceUrl || '').trim();
  const topicCountRaw = Number(body?.topicCount ?? 8);
  const topicCount = Number.isFinite(topicCountRaw) ? Math.max(1, Math.min(20, Math.floor(topicCountRaw))) : 8;
  if (!sourceTitle) return NextResponse.json({ success: false, error: 'sourceTitle is required' }, { status: 400 });
  if (!sourceUrl) return NextResponse.json({ success: false, error: 'sourceUrl is required' }, { status: 400 });

  // Phase E: per-account Poppy routing + Ideas prompt override.
  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('poppy_conversation_url, ideas_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) return NextResponse.json({ success: false, error: settingsErr.message }, { status: 500 });
  // Backwards-safe legacy fallback.
  const { data: editorRow, error: editorErr } = await supabase
    .from('editor_users')
    .select('poppy_conversation_url, ideas_prompt_override')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorErr) return NextResponse.json({ success: false, error: editorErr.message }, { status: 500 });

  const poppyConversationUrl =
    String((settingsRow as any)?.poppy_conversation_url || '').trim() ||
    String((editorRow as any)?.poppy_conversation_url || '').trim();
  if (!poppyConversationUrl) {
    return NextResponse.json({ success: false, error: 'Missing poppy_conversation_url for this account' }, { status: 400 });
  }

  const ideasPromptTemplate =
    String((settingsRow as any)?.ideas_prompt_override || '').trim() ||
    String((editorRow as any)?.ideas_prompt_override || '').trim() ||
    DEFAULT_IDEAS_PROMPT;

  // Non-secret debug metadata (board/chat/model), persisted on the run row.
  let poppyRoutingMeta: { boardId: string | null; chatId: string | null; model: string | null } = {
    boardId: null,
    chatId: null,
    model: null,
  };
  try {
    const u = new URL(poppyConversationUrl);
    poppyRoutingMeta = {
      boardId: String(u.searchParams.get('board_id') || '').trim() || null,
      chatId: String(u.searchParams.get('chat_id') || '').trim() || null,
      model: String(u.searchParams.get('model') || '').trim() || null,
    };
  } catch {
    // ignore; callPoppy will throw clearer error if invalid
  }

  const promptRendered = renderTemplate(ideasPromptTemplate, {
    sourceTitle,
    sourceUrl,
    topicCount: String(topicCount),
    audience: 'business owners',
  });

  // Create or reuse Source group.
  const nowIso = new Date().toISOString();
  const upsertPayload = {
    account_id: accountId,
    owner_user_id: user.id,
    source_title: sourceTitle,
    source_url: sourceUrl,
    updated_at: nowIso,
  };

  const upsertSource = async (onConflict: string) => {
    const { data, error } = await supabase
      .from('editor_idea_sources')
      .upsert(upsertPayload as any, { onConflict })
      .select('id, source_title, source_url, last_generated_at, created_at, updated_at')
      .single();
    return { data, error };
  };
  // Phase G: prefer account-scoped uniqueness; fall back to legacy owner-scoped constraint if migration not applied.
  const { data: sourceRow, error: sourceErr } = await (async () => {
    const res = await upsertSource('account_id,source_title,source_url');
    if (!res.error) return res;
    const msg = String((res.error as any)?.message || '').toLowerCase();
    if (msg.includes('no unique') || msg.includes('conflict')) {
      return await upsertSource('owner_user_id,source_title,source_url');
    }
    return res;
  })();

  if (sourceErr || !sourceRow) {
    return NextResponse.json({ success: false, error: sourceErr?.message || 'Failed to upsert source' }, { status: 500 });
  }

  // Create run row (running).
  const { data: runRow, error: runErr } = await supabase
    .from('editor_idea_runs')
    .insert({
      account_id: accountId,
      owner_user_id: user.id,
      source_id: sourceRow.id,
      status: 'running',
      error: 'progress:poppy',
      prompt_rendered: promptRendered,
      poppy_routing_meta: poppyRoutingMeta,
      created_at: nowIso,
    })
    .select('id, status')
    .single();

  if (runErr || !runRow) {
    return NextResponse.json({ success: false, error: runErr?.message || 'Failed to create run' }, { status: 500 });
  }

  const runId = String(runRow.id);

  try {
    const poppy = await callPoppy(promptRendered, { poppyConversationUrl });
    await updateRunProgress(supabase, { runId, accountId, userId: user.id }, { status: 'running', error: 'progress:parse' });
    const parsed = await callAnthropicParseIdeas({ rawToParse: poppy.rawText, topicCount });
    const payload = extractJsonObject(parsed.rawText);
    assertValidIdeasPayload(payload, topicCount);

    const topics: TopicOut[] = (payload.topics as any[]).map((t: any) => ({
      title: String(t.title || ''),
      bullets: Array.isArray(t.bullets)
        ? t.bullets.map((g: any) => ({
            heading: String(g.heading || ''),
            points: Array.isArray(g.points) ? g.points.map((p: any) => String(p ?? '')) : [],
          }))
        : [],
    }));

    // Persist ideas
    await updateRunProgress(supabase, { runId, accountId, userId: user.id }, { status: 'running', error: 'progress:save' });
    const ideaRows = topics.map((t) => ({
      account_id: accountId,
      owner_user_id: user.id,
      source_id: sourceRow.id,
      run_id: runId,
      title: t.title,
      bullets: t.bullets,
      status: 'pending',
      approved_sort_index: null,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const { error: ideasErr } = await supabase.from('editor_ideas').insert(ideaRows as any);
    if (ideasErr) throw new Error(ideasErr.message || 'Failed to insert ideas');

    await supabase
      .from('editor_idea_sources')
      .update({ last_generated_at: nowIso, updated_at: nowIso })
      .eq('id', sourceRow.id)
      .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`);

    await supabase
      .from('editor_idea_runs')
      .update({ status: 'completed', error: null, finished_at: nowIso })
      .eq('id', runId)
      .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`);

    return NextResponse.json({
      success: true,
      source: {
        id: String(sourceRow.id),
        sourceTitle: String(sourceRow.source_title || sourceTitle),
        sourceUrl: String(sourceRow.source_url || sourceUrl),
      },
      run: {
        id: runId,
        topicCount,
        promptRendered,
        poppyRoutingMeta,
      },
      topics,
    });
  } catch (e: any) {
    const msg = String(e?.message || 'Generate ideas failed');
    await supabase
      .from('editor_idea_runs')
      .update({ status: 'failed', error: msg, finished_at: new Date().toISOString() })
      .eq('id', runId)
      .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`);
    return NextResponse.json({ success: false, error: msg, runId }, { status: 500 });
  }
}

