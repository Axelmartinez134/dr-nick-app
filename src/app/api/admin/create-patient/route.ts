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
    const { email, password, fullName, weekZeroData, weightChangeGoalPercent, proteinGoalGrams, drNickCoachingNotes } = await request.json()

    // Validate required fields
    if (!email || !password || !fullName || !weekZeroData) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Step 1: Check email availability using admin client
    const { data: existingUser, error: checkError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 400 })
    }

    // Step 2: Create auth user with admin client (server-side, no auto-login)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      user_metadata: {
        full_name: fullName
      },
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json({ success: false, error: `Failed to create account: ${authError.message}` }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ success: false, error: 'Failed to create user account' }, { status: 500 })
    }

    const userId = authData.user.id

    // Step 3: Create profile using admin client (bypasses RLS)
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: userId,
        email: email.toLowerCase(),
        full_name: fullName,
        patient_password: password,
        weight_change_goal_percent: weightChangeGoalPercent || 1.0,
        height: parseFloat(weekZeroData.height) || null,
        protein_goal_grams: proteinGoalGrams || 150,
        dr_nick_coaching_notes: drNickCoachingNotes || null
      })

    if (profileError) {
      return NextResponse.json({ success: false, error: `Failed to create profile: ${profileError.message}` }, { status: 500 })
    }

    // Step 4: Create Week 0 baseline data using admin client (bypasses RLS)
    const today = new Date().toISOString().split('T')[0]
    const { error: healthError } = await adminClient
      .from('health_data')
      .insert({
        user_id: userId,
        date: today,
        week_number: 0,
        weight: parseFloat(weekZeroData.weight) || null,
        waist: parseFloat(weekZeroData.waist) || null,
        data_entered_by: 'dr_nick',
        needs_review: false,
        initial_weight: parseFloat(weekZeroData.weight) || null
      })

    if (healthError) {
      return NextResponse.json({ success: false, error: `Failed to setup Week 0 baseline: ${healthError.message}` }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      patientId: userId,
      credentials: {
        email: email,
        password: password
      }
    })

  } catch (err) {
    return NextResponse.json({ success: false, error: `Unexpected error: ${err}` }, { status: 500 })
  }
} 