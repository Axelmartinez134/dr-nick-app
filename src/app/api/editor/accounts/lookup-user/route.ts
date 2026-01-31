import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | { success: true; exists: boolean; userId: string | null }
  | { success: false; error: string };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getAuthUserByEmail(admin: any, email: string): Promise<{ userId: string | null }> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return { userId: null };

  const direct = admin?.auth?.admin?.getUserByEmail;
  if (typeof direct === 'function') {
    const { data, error } = await direct.call(admin.auth.admin, e);
    if (error) return { userId: null };
    const id = String(data?.user?.id || '').trim();
    return { userId: id || null };
  }

  // Fallback: list a page and scan (should be rare).
  const list = admin?.auth?.admin?.listUsers;
  if (typeof list === 'function') {
    const { data, error } = await list.call(admin.auth.admin, { page: 1, perPage: 1000 });
    if (error) return { userId: null };
    const users = Array.isArray((data as any)?.users) ? (data as any).users : [];
    const match = users.find((u: any) => String(u?.email || '').toLowerCase() === e);
    const id = String(match?.id || '').trim();
    return { userId: id || null };
  }

  return { userId: null };
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp,
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const email = String(body?.email || '').trim();
  if (!email) return NextResponse.json({ success: false, error: 'email is required' } satisfies Resp, { status: 400 });

  const { userId } = await getAuthUserByEmail(admin, email);
  return NextResponse.json({ success: true, exists: !!userId, userId } satisfies Resp);
}

