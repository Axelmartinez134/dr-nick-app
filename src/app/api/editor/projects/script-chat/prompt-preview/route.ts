import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | { success: true; threadId: string; system: string; contextText: string }
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
  if (!saRow?.user_id) return { ok: false as const, status: 403 as const, error: 'Forbidden' };
  return { ok: true as const };
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

function buildSystemPrompt(): string {
  return sanitizeText(
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
}

async function ensureThread(args: { supabase: any; accountId: string; userId: string; projectId: string }) {
  const { supabase, accountId, userId, projectId } = args;

  const { data: existing, error: exErr } = await supabase
    .from('editor_project_script_threads')
    .select('id, context_snapshot')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  const existingSnap = (existing as any)?.context_snapshot || null;
  if (existingId && existingSnap) return { threadId: existingId, contextSnapshot: existingSnap };

  // Create thread by capturing frozen context snapshot (must have deterministic layouts).
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
    if (!Array.isArray(lines)) throw new Error('Generate/Realign first.');
  }

  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);
  const brandVoice = String((settingsRow as any)?.brand_alignment_prompt_override ?? '');

  const snapshot = {
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
  if (inserted?.id && (inserted as any)?.context_snapshot) {
    return { threadId: String((inserted as any).id), contextSnapshot: (inserted as any).context_snapshot };
  }

  // Race fallback: re-read.
  const { data: reread, error: rrErr } = await supabase
    .from('editor_project_script_threads')
    .select('id, context_snapshot')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (rrErr) throw new Error(rrErr.message);
  const rrId = String((reread as any)?.id || '').trim();
  const rrSnap = (reread as any)?.context_snapshot || null;
  if (!rrId || !rrSnap) throw new Error('Failed to create script chat thread');
  return { threadId: rrId, contextSnapshot: rrSnap };
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const projectId = String(searchParams.get('projectId') || '').trim();
    if (!projectId || !isUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    }

    const ensured = await ensureThread({ supabase, accountId, userId: user.id, projectId });
    const system = buildSystemPrompt();
    const contextText = contextToText(ensured.contextSnapshot);

    return NextResponse.json({ success: true, threadId: ensured.threadId, system, contextText } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg.toLowerCase().includes('generate/realign first') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}

