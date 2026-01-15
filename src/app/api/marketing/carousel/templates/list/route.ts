import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ListTemplatesResponse {
  success: boolean;
  templates?: Array<{ id: string; name: string; updatedAt: string }>;
  error?: string;
}

export async function GET(request: NextRequest) {
  // AUTH CHECK (any authenticated user)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as ListTemplatesResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as ListTemplatesResponse, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as ListTemplatesResponse, { status: 401 });
  }

  const { data, error } = await supabase
    .from('carousel_templates')
    .select('id, name, updated_at')
    .eq('owner_user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message } as ListTemplatesResponse, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    templates: (data || []).map((t: any) => ({ id: t.id, name: t.name, updatedAt: t.updated_at })),
  } as ListTemplatesResponse);
}



