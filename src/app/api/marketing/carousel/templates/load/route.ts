import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface LoadTemplateResponse {
  success: boolean;
  template?: { id: string; name: string; definition: any; updatedAt: string; ownerUserId: string };
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Template id is required' } as LoadTemplateResponse, { status: 400 });
  }

  // AUTH CHECK (any authenticated user)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as LoadTemplateResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as LoadTemplateResponse, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as LoadTemplateResponse, { status: 401 });
  }

  const { data, error } = await supabase
    .from('carousel_templates')
    .select('id, name, owner_user_id, definition, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || 'Template not found' } as LoadTemplateResponse, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    template: {
      id: data.id,
      name: data.name,
      ownerUserId: data.owner_user_id,
      definition: data.definition,
      updatedAt: data.updated_at,
    },
  } as LoadTemplateResponse);
}



