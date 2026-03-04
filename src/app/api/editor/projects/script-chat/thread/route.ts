import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type MessageOut = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

type Resp =
  | { success: true; threadId: string; messages: MessageOut[] }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
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

async function loadFrozenContextOrThrow(args: { supabase: any; accountId: string; projectId: string }) {
  const { supabase, accountId, projectId } = args;

  // Project must exist in this account.
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, title, caption')
    .eq('account_id', accountId)
    .eq('id', projectId)
    .is('archived_at', null)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  if (!project?.id) throw new Error('Project not found');

  // Slides must have deterministic layout snapshots (textLines present).
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

  // Brand voice (per-account)
  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);
  const brandVoice = String((settingsRow as any)?.brand_alignment_prompt_override ?? '');

  return {
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
}): Promise<string> {
  const { supabase, accountId, userId, projectId } = args;

  const { data: existing, error: exErr } = await supabase
    .from('editor_project_script_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  // Frozen context snapshot is captured at thread creation.
  const ctx = await loadFrozenContextOrThrow({ supabase, accountId, projectId });
  const snapshot = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    project: ctx.project,
    brandVoice: ctx.brandVoice,
    slides: ctx.slides,
  };

  const { data: inserted, error: insErr } = await supabase
    .from('editor_project_script_threads')
    .insert({
      account_id: accountId,
      project_id: projectId,
      created_by_user_id: userId,
      context_snapshot: snapshot as any,
    } as any)
    .select('id')
    .maybeSingle();

  if (insErr) {
    const code = (insErr as any)?.code;
    if (code !== '23505') throw new Error(insErr.message);
  }

  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  // Race fallback: re-read.
  const { data: reread, error: rrErr } = await supabase
    .from('editor_project_script_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (rrErr) throw new Error(rrErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create script chat thread');
  return rereadId;
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

    const threadId = await ensureThread({ supabase, accountId, userId: user.id, projectId });

    const { data: rows, error: msgErr } = await supabase
      .from('editor_project_script_messages')
      .select('id, role, content, created_at')
      .eq('account_id', accountId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (msgErr) return NextResponse.json({ success: false, error: msgErr.message } satisfies Resp, { status: 500 });
    const out: MessageOut[] = Array.isArray(rows)
      ? (rows as any[])
          .map((r) => ({
            id: String(r.id),
            role: (String(r.role) === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: String(r.content || ''),
            createdAt: String(r.created_at || ''),
          }))
          .reverse()
      : [];

    return NextResponse.json({ success: true, threadId, messages: out } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg.toLowerCase().includes('generate/realign first') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}

