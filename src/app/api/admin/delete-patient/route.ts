import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client (service role) to bypass RLS
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

    const { patientId, confirm } = await request.json()

    if (!patientId) {
      return NextResponse.json({ success: false, error: 'Missing required field: patientId' }, { status: 400 })
    }

    if (confirm !== 'DELETE') {
      return NextResponse.json({ success: false, error: "Confirmation text must be 'DELETE'" }, { status: 400 })
    }

    // 1) Delete all health_data rows for this user
    const { error: healthDeleteError } = await adminClient
      .from('health_data')
      .delete()
      .eq('user_id', patientId)

    if (healthDeleteError) {
      console.error('Delete patient health_data error:', healthDeleteError)
      return NextResponse.json({ success: false, error: `Failed to delete health data: ${healthDeleteError.message}` }, { status: 500 })
    }

    // 2) Delete profile row
    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', patientId)

    if (profileDeleteError) {
      console.error('Delete patient profile error:', profileDeleteError)
      return NextResponse.json({ success: false, error: `Failed to delete profile: ${profileDeleteError.message}` }, { status: 500 })
    }

    // 3) Delete auth user
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(patientId)
    if (authDeleteError) {
      console.error('Delete auth user error:', authDeleteError)
      return NextResponse.json({ success: false, error: `Failed to delete auth user: ${authDeleteError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete patient unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


