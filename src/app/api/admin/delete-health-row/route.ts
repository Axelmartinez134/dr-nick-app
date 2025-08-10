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

    const { rowId, confirm } = await request.json()

    if (!rowId) {
      return NextResponse.json({ success: false, error: 'Missing required field: rowId' }, { status: 400 })
    }

    if (confirm !== 'DELETE') {
      return NextResponse.json({ success: false, error: "Confirmation text must be 'DELETE'" }, { status: 400 })
    }

    const { error } = await adminClient
      .from('health_data')
      .delete()
      .eq('id', rowId)

    if (error) {
      console.error('Delete health row error:', error)
      return NextResponse.json({ success: false, error: `Failed to delete row: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete health row unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


