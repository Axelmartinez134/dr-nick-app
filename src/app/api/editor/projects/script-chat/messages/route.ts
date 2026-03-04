import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Body = {
  projectId: string;
  content: string;
};

type MessageOut = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

type Resp =
  | { success: true; threadId: string; appended: { user: MessageOut; assistant: MessageOut } }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

function sanitizeText(input: string): string {
  // Preserve tabs/newlines but remove other control chars that can break JSON/logging.
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
}

async function assertSuperadmin(supabase: any, userId: string) {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) throw new Error(saErr.message);
  if (!saRow?.user_id) {
    return { ok: false as const, status: 403 as const, error: 'Forbidden' };
  }
  return { ok: true as const };
}

async function loadThread(args: { supabase: any; accountId: string; projectId: string }) {
  const { supabase, accountId, projectId } = args;
  const { data: row, error } = await supabase
    .from('editor_project_script_threads')
    .select('id, context_snapshot')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row as any | null;
}

async function loadFrozenContextOrThrow(args: { supabase: any; accountId: string; projectId: string }) {
  const { supabase, accountId, projectId } = args;

  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, title, caption')
    .eq('account_id', accountId)
    .eq('id', projectId)
    .is('archived_at', null)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  if (!project?.id) throw new Error('Project not found');

  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, layout_snapshot')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr) throw new Error(slidesErr.message);
  if (!Array.isArray(slides) || slides.length !== 6) throw new Error('Could not load slides');

  for (const s of slides as any[]) {
    const snap = s?.layout_snapshot;
    const lines = snap && typeof snap === 'object' ? (snap as any).textLines : null;
    if (!Array.isArray(lines)) {
      throw new Error('Generate/Realign first.');
    }
  }

  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);
  const brandVoice = String((settingsRow as any)?.brand_alignment_prompt_override ?? '');

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    project: {
      id: String((project as any).id),
      title: String((project as any).title || ''),
      caption: String((project as any).caption || ''),
    },
    brandVoice,
    slides: (slides as any[]).map((r, idx) => {
      const snap = r?.layout_snapshot;
      const lines = Array.isArray(snap?.textLines) ? (snap.textLines as any[]) : [];
      return {
        slideIndex: typeof r?.slide_index === 'number' ? r.slide_index : idx,
        textLines: lines.map((l) => String(l?.text ?? '')).filter((t) => t !== null && t !== undefined),
      };
    }),
  };
}

async function ensureThread(args: {
  supabase: any;
  accountId: string;
  userId: string;
  projectId: string;
}): Promise<{ threadId: string; contextSnapshot: any }> {
  const { supabase, accountId, userId, projectId } = args;

  const existing = await loadThread({ supabase, accountId, projectId });
  if (existing?.id && existing?.context_snapshot) {
    return { threadId: String(existing.id), contextSnapshot: (existing as any).context_snapshot };
  }

  const snapshot = await loadFrozenContextOrThrow({ supabase, accountId, projectId });

  const { data: inserted, error: insErr } = await supabase
    .from('editor_project_script_threads')
    .insert({
      account_id: accountId,
      project_id: projectId,
      created_by_user_id: userId,
      context_snapshot: snapshot as any,
    } as any)
    .select('id, context_snapshot')
    .maybeSingle();

  if (insErr) {
    const code = (insErr as any)?.code;
    if (code !== '23505') throw new Error(insErr.message);
  }

  if (inserted?.id) {
    return { threadId: String((inserted as any).id), contextSnapshot: (inserted as any).context_snapshot };
  }

  // Race fallback: re-read.
  const reread = await loadThread({ supabase, accountId, projectId });
  if (!reread?.id || !(reread as any)?.context_snapshot) throw new Error('Failed to create script chat thread');
  return { threadId: String((reread as any).id), contextSnapshot: (reread as any).context_snapshot };
}

function contextToText(snapshot: any): string {
  const proj = snapshot?.project || {};
  const slides = Array.isArray(snapshot?.slides) ? snapshot.slides : [];
  const brandVoice = String(snapshot?.brandVoice ?? '');
  const caption = String(proj?.caption ?? '');
  const title = String(proj?.title ?? '');

  const slidesText = slides
    .slice()
    .sort((a: any, b: any) => Number(a?.slideIndex) - Number(b?.slideIndex))
    .map((s: any) => {
      const idx = Number.isFinite(s?.slideIndex) ? Number(s.slideIndex) : 0;
      const lines = Array.isArray(s?.textLines) ? s.textLines.map((t: any) => String(t ?? '')) : [];
      const joined = lines.length ? lines.join('\n') : '(no text lines)';
      return `SLIDE ${idx + 1} (textLines):\n${joined}`;
    })
    .join('\n\n');

  return sanitizeText(
    [
      `PROJECT_TITLE:\n${title || '-'}`,
      ``,
      `BRAND_VOICE:\n${brandVoice || '-'}`,
      ``,
      `CAROUSEL_TEXTLINES:\n${slidesText || '-'}`,
      ``,
      `CAPTION:\n${caption || '-'}`,
    ].join('\n')
  );
}

async function callAnthropicChat(args: {
  system: string;
  contextText: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Script Chat ONLY: Opus 4.6 (do not affect other /editor calls).
  const model = 'claude-opus-4-6';

  const contextBlock = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: args.contextText,
        cache_control: { type: 'ephemeral' },
      },
    ],
  };

  const messages: any[] = [
    contextBlock,
    ...(args.history || []).map((m) => ({ role: m.role, content: sanitizeText(m.content) })),
    { role: 'user', content: args.userMessage },
  ];

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
        max_tokens: 1400,
        temperature: 0.4,
        system: args.system,
        messages,
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic error (${res.status}): ${msg}`);
    }
    const text = String(json?.content?.[0]?.text || '');
    return { text, model };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await getAuthedSupabase(request);
    if (!authed.ok) {
      return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
    }
    const { supabase, user } = authed;

    const sa = await assertSuperadmin(supabase, user.id);
    if (!sa.ok) return NextResponse.json({ success: false, error: sa.error } satisfies Resp, { status: sa.status });

    const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
    if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
    const accountId = acct.accountId;

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
    }

    const projectId = String(body?.projectId || '').trim();
    const content = String(body?.content || '').trim();
    if (!projectId || !isUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    }
    if (!content) return NextResponse.json({ success: false, error: 'Missing content' } satisfies Resp, { status: 400 });
    if (content.length > 10_000) return NextResponse.json({ success: false, error: 'Message too long' } satisfies Resp, { status: 400 });

    const ensured = await ensureThread({ supabase, accountId: accountId, userId: user.id, projectId });
    const threadId = ensured.threadId;
    const contextSnapshot = ensured.contextSnapshot;

    // Persist user message first.
    const userText = sanitizeText(content);
    const { data: userRow, error: userMsgErr } = await supabase
      .from('editor_project_script_messages')
      .insert({
        account_id: accountId,
        thread_id: threadId,
        created_by_user_id: user.id,
        role: 'user',
        content: userText,
      } as any)
      .select('id, role, content, created_at')
      .single();
    if (userMsgErr) return NextResponse.json({ success: false, error: userMsgErr.message } satisfies Resp, { status: 500 });

    // Load recent history (latest 24 messages, oldest->newest), excluding the message we just inserted is fine (it will be included).
    const { data: historyRows, error: historyErr } = await supabase
      .from('editor_project_script_messages')
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

    const system = sanitizeText(
      [
        `You are an expert short-form video scriptwriting assistant.`,
        `You are helping the user write a script they will speak on camera (Reels/TikTok).`,
        ``,
        `HARD RULES:`,
        `- Respond in plain text only (no markdown, no bullet characters, no headings).`,
        `- Be concise and practical.`,
        `- If you propose lines, write them as spoken dialogue.`,
        `- Ask a clarifying question when needed, but keep it minimal.`,
      ].join('\n')
    );

    const contextText = contextToText(contextSnapshot);

    const anthropic = await callAnthropicChat({
      system,
      contextText,
      history,
      userMessage: userText,
    });
    const assistantText = sanitizeText(anthropic.text);
    if (!assistantText) throw new Error('Claude returned an empty response');

    const { data: assistantRow, error: assistantErr } = await supabase
      .from('editor_project_script_messages')
      .insert({
        account_id: accountId,
        thread_id: threadId,
        created_by_user_id: user.id,
        role: 'assistant',
        content: assistantText,
      } as any)
      .select('id, role, content, created_at')
      .single();
    if (assistantErr) return NextResponse.json({ success: false, error: assistantErr.message } satisfies Resp, { status: 500 });

    const userOut: MessageOut = {
      id: String((userRow as any).id),
      role: 'user',
      content: String((userRow as any).content || ''),
      createdAt: String((userRow as any).created_at || ''),
    };
    const assistantOut: MessageOut = {
      id: String((assistantRow as any).id),
      role: 'assistant',
      content: String((assistantRow as any).content || ''),
      createdAt: String((assistantRow as any).created_at || ''),
    };

    return NextResponse.json({ success: true, threadId, appended: { user: userOut, assistant: assistantOut } } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg.toLowerCase().includes('generate/realign first') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}

