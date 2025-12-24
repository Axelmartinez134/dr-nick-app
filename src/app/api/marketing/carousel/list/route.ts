import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface CarouselListItem {
  id: string;
  title: string;
  headline: string;
  createdAt: string;
  updatedAt: string;
}

interface ListCarouselsResponse {
  success: boolean;
  carousels?: CarouselListItem[];
  error?: string;
}

export async function GET(request: NextRequest) {
  console.log('[List API] 📋 ==================== LIST CAROUSELS REQUEST ====================');

  // AUTH CHECK
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[List API] ❌ Missing or invalid authorization header');
    return NextResponse.json({ success: false, error: 'Unauthorized' } as ListCarouselsResponse, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  console.log('[List API] 🔐 Verifying user token...');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[List API] ❌ Supabase environment variables not configured');
    return NextResponse.json({ success: false, error: 'Server configuration error' } as ListCarouselsResponse, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('[List API] ❌ Invalid token or user not found:', userError?.message);
    return NextResponse.json({ success: false, error: 'Unauthorized' } as ListCarouselsResponse, { status: 401 });
  }

  console.log('[List API] ✅ User authenticated:', user.email);

  try {
    console.log('[List API] 📥 Fetching carousels for user:', user.id);

    const { data, error } = await supabase
      .from('ai_carousels')
      .select('id, title, headline, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }); // Most recently updated first

    if (error) {
      console.error('[List API] ❌ Query failed:', error);
      return NextResponse.json({ success: false, error: error.message } as ListCarouselsResponse, { status: 500 });
    }

    console.log('[List API] ✅ Found', data.length, 'carousels');

    const carousels: CarouselListItem[] = data.map((item) => ({
      id: item.id,
      title: item.title,
      headline: item.headline,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return NextResponse.json({ success: true, carousels } as ListCarouselsResponse);
  } catch (error) {
    console.error('[List API] ❌ List failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list carousels',
      } as ListCarouselsResponse,
      { status: 500 }
    );
  }
}

