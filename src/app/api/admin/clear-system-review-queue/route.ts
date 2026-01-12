import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side admin client using service role key (bypasses RLS)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: NextRequest) {
  try {
    // Admin auth check: require Bearer token and admin email
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const verificationClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: userError } = await verificationClient.auth.getUser(token)
    if (userError || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const confirm = String(body?.confirm || '')
    if (confirm !== 'CLEAR') {
      return NextResponse.json({ success: false, error: "Confirmation text must be 'CLEAR'" }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('health_data')
      .update({
        needs_review: false,
        updated_at: new Date().toISOString(),
      })
      .eq('needs_review', true)
      .eq('data_entered_by', 'system')
      .select('id')

    if (error) {
      console.error('Clear system review queue error:', error)
      return NextResponse.json({ success: false, error: `Failed to clear system queue: ${error.message}` }, { status: 500 })
    }

    const clearedCount = Array.isArray(data) ? data.length : 0
    return NextResponse.json({ success: true, clearedCount })
  } catch (error) {
    console.error('Clear system review queue unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

