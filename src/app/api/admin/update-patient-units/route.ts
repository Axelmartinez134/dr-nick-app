import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side admin client using service role key
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const { patientId, unitSystem } = await request.json()

    if (!patientId || !unitSystem) {
      return NextResponse.json({ success: false, error: 'Missing required fields: patientId and unitSystem' }, { status: 400 })
    }

    if (unitSystem !== 'imperial' && unitSystem !== 'metric') {
      return NextResponse.json({ success: false, error: 'Invalid unitSystem. Must be imperial or metric' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('profiles')
      .update({ unit_system: unitSystem })
      .eq('id', patientId)
      .select('id, unit_system')
      .single()

    if (error) {
      console.error('Unit system update error:', error)
      return NextResponse.json({ success: false, error: `Failed to update unit system: ${error.message}` }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, unit_system: data.unit_system })
  } catch (error) {
    console.error('Update patient unit system error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


