import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

export async function POST(request: NextRequest) {
  try {
    const { patientId, trackBodyComposition } = await request.json()
    if (!patientId || typeof trackBodyComposition !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('profiles')
      .update({ track_body_composition: trackBodyComposition })
      .eq('id', patientId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: `Unexpected error: ${err?.message || err}` }, { status: 500 })
  }
}


