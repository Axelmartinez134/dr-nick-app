import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

interface UpdateTemplateRequest {
  id: string;
  name?: string;
  definition?: any;
}

interface UpdateTemplateResponse {
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  // AUTH CHECK (editor users)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UpdateTemplateResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as UpdateTemplateResponse, { status: 500 });
  }

  const authedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await authedClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UpdateTemplateResponse, { status: 401 });
  }

  // Must be an editor user (RLS on editor_users allows select self).
  const { data: editorRow, error: editorErr } = await authedClient
    .from('editor_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorErr || !editorRow?.user_id) {
    return NextResponse.json({ success: false, error: 'Forbidden - Editor access required' } as UpdateTemplateResponse, { status: 403 });
  }

  let body: UpdateTemplateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } as UpdateTemplateResponse, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ success: false, error: 'Template id is required' } as UpdateTemplateResponse, { status: 400 });
  }

  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name;
  if (body.definition !== undefined) patch.definition = body.definition;

  const accountHeader = String(request.headers.get('x-account-id') || '').trim();

  // IMPORTANT:
  // For account-scoped editing, templates are shared within the account.
  // For legacy (no x-account-id), we keep owner-only behavior for non-editor marketing pages.
  const svc = serviceClient();
  const client = svc || authedClient;

  if (accountHeader) {
    const { data: mem, error: memErr } = await authedClient
      .from('editor_account_memberships')
      .select('role')
      .eq('account_id', accountHeader)
      .eq('user_id', user.id)
      .maybeSingle();
    if (memErr) {
      return NextResponse.json({ success: false, error: memErr.message } as UpdateTemplateResponse, { status: 500 });
    }
    const role = String((mem as any)?.role || '');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' } as UpdateTemplateResponse, { status: 403 });
    }
  }

  const q = client.from('carousel_templates').update(patch).eq('id', body.id);
  const { data: updated, error } = await (accountHeader ? q.eq('account_id', accountHeader) : q.eq('owner_user_id', user.id))
    .select('id')
    .maybeSingle();

  if (error) {
    const msg = String(error.message || 'Update failed');
    const hint = msg.includes('row-level security')
      ? `${msg} (Hint: ensure your admin user exists in admin_users and that the 20251225_000001_create_carousel_templates.sql migration has been applied.)`
      : msg;
    return NextResponse.json({ success: false, error: hint } as UpdateTemplateResponse, { status: 400 });
  }

  if (!updated?.id) {
    return NextResponse.json(
      { success: false, error: 'Template not updated (permission or not found)' } as UpdateTemplateResponse,
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true } as UpdateTemplateResponse);
}


