import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  googleDriveFolderId: string | null;
};

function sanitizeFolderId(input: unknown): string | null {
  const raw = typeof input === 'string' ? input : input == null ? '' : String(input);
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {
      const pathMatch = url.pathname.match(/\/(?:drive\/folders|folders)\/([A-Za-z0-9_-]+)/);
      const queryId = url.searchParams.get('id');
      candidate = pathMatch?.[1] || queryId || '';
    }
  } catch {
    // Treat as raw id.
  }

  const next = String(candidate || '').trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(next)) return null;
  return next.slice(0, 512);
}

async function requireSuperadmin(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: authed.error }, { status: authed.status }) };
  }

  const { supabase, user } = authed;
  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: acct.error }, { status: acct.status }) };
  }

  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: saErr.message }, { status: 500 }) };
  }
  if (!saRow?.user_id) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true as const, supabase, accountId: acct.accountId };
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.response;

  const { data: settingsRow, error: settingsErr } = await auth.supabase
    .from('editor_account_settings')
    .select('google_drive_folder_id')
    .eq('account_id', auth.accountId)
    .maybeSingle();
  if (settingsErr) {
    return NextResponse.json({ success: false, error: settingsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    googleDriveFolderId: String((settingsRow as any)?.google_drive_folder_id ?? ''),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const provided = (body as any)?.googleDriveFolderId;
  const next = sanitizeFolderId(provided);
  if (provided != null && String(provided).trim() && !next) {
    return NextResponse.json(
      { success: false, error: 'Enter a valid Google Drive folder ID or folder URL' },
      { status: 400 }
    );
  }
  const { error: upErr } = await auth.supabase
    .from('editor_account_settings')
    .upsert({ account_id: auth.accountId, google_drive_folder_id: next }, { onConflict: 'account_id' });
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, googleDriveFolderId: next ?? '' });
}
