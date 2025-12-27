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
  // AUTH CHECK (admin-only)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UpdateTemplateResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as UpdateTemplateResponse, { status: 500 });
  }

  // Verify email matches configured admin (app-level guard).
  const verificationClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user }, error: userError } = await verificationClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UpdateTemplateResponse, { status: 401 });
  }
  if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ success: false, error: 'Forbidden - Admin access required' } as UpdateTemplateResponse, { status: 403 });
  }

  // Ensure the admin user is present in admin_users so RLS writes succeed.
  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Server missing Supabase service role env (needed to bootstrap admin_users for template writes). Set SUPABASE_SERVICE_ROLE_KEY.',
      } as UpdateTemplateResponse,
      { status: 500 }
    );
  }
  try {
    await svc.from('admin_users').upsert({ user_id: user.id }, { onConflict: 'user_id' });
  } catch {
    // no-op; RLS error will surface below if needed.
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

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

  const { error } = await supabase
    .from('carousel_templates')
    .update(patch)
    .eq('id', body.id)
    .eq('owner_user_id', user.id);

  if (error) {
    const msg = String(error.message || 'Update failed');
    const hint = msg.includes('row-level security')
      ? `${msg} (Hint: ensure your admin user exists in admin_users and that the 20251225_000001_create_carousel_templates.sql migration has been applied.)`
      : msg;
    return NextResponse.json({ success: false, error: hint } as UpdateTemplateResponse, { status: 400 });
  }

  return NextResponse.json({ success: true } as UpdateTemplateResponse);
}


