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
    const { patientId, clientStatus } = await request.json()

    // Validate required fields
    if (!patientId || !clientStatus) {
      return NextResponse.json({ success: false, error: 'Missing required fields: patientId and clientStatus' }, { status: 400 })
    }

    // Validate status value
    const validStatuses = ['Current', 'Past', 'Onboarding', 'Test']
    if (!validStatuses.includes(clientStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid client status. Must be Current, Past, Onboarding, or Test' }, { status: 400 })
    }

    // Update patient status using admin client (bypasses RLS)
    const { data, error } = await adminClient
      .from('profiles')
      .update({ client_status: clientStatus })
      .eq('id', patientId)
      .select('id, full_name, client_status')
      .single()

    if (error) {
      console.error('Status update error:', error)
      return NextResponse.json({ success: false, error: `Failed to update patient status: ${error.message}` }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Patient status updated to ${clientStatus}`,
      patient: {
        id: data.id,
        name: data.full_name,
        status: data.client_status
      }
    })

  } catch (error) {
    console.error('Update patient status error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 