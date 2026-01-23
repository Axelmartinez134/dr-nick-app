import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  aiImageGenModel: 'gpt-image-1.5' | 'gemini-3-pro-image-preview';
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  // Must be an editor user (RLS: select self).
  const { data: editorRow, error: editorErr } = await supabase
    .from('editor_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorErr || !editorRow?.user_id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const next = String((body as any)?.aiImageGenModel || '').trim();
  if (next !== 'gpt-image-1.5' && next !== 'gemini-3-pro-image-preview') {
    return NextResponse.json({ success: false, error: 'Invalid aiImageGenModel' }, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env' },
      { status: 500 }
    );
  }

  const { error: upErr } = await svc
    .from('editor_users')
    .update({ ai_image_gen_model: next })
    .eq('user_id', user.id);
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, aiImageGenModel: next });
}

