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
    const { email, password, fullName, weekZeroData, weightChangeGoalPercent, proteinGoalGrams, resistanceTrainingGoal, drNickCoachingNotes, clientStatus, unitSystem } = await request.json()

    // DEBUG: Log the coaching notes being received
    console.log('DEBUG: Received drNickCoachingNotes:', drNickCoachingNotes)

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

    // Convert incoming Week 0 measurements to canonical Imperial units if needed
    const isMetric = unitSystem === 'metric'
    const toTwo = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)
    const kgToLbs = (kg: number | null) => (kg === null ? null : kg / 0.45359237)
    const cmToIn = (cm: number | null) => (cm === null ? null : cm / 2.54)

    const rawWeight = weekZeroData?.weight ? parseFloat(weekZeroData.weight) : null
    const rawWaist = weekZeroData?.waist ? parseFloat(weekZeroData.waist) : null
    const rawHeight = weekZeroData?.height ? parseFloat(weekZeroData.height) : null

    const weightLbs = toTwo(isMetric ? kgToLbs(rawWeight) : rawWeight)
    const waistInches = toTwo(isMetric ? cmToIn(rawWaist) : rawWaist)
    const heightInches = toTwo(isMetric ? cmToIn(rawHeight) : rawHeight)

    // DEBUG: Log the profile data being inserted
    const profileData: any = {
      id: userId,
      email: email.toLowerCase(),
      full_name: fullName,
      patient_password: password,
      weight_change_goal_percent: weightChangeGoalPercent || 1.0,
      height: heightInches,
      protein_goal_grams: proteinGoalGrams || 150,
      resistance_training_days_goal: resistanceTrainingGoal || 0,
      dr_nick_coaching_notes: drNickCoachingNotes || null,
      client_status: clientStatus || 'Current',
      unit_system: unitSystem === 'metric' ? 'metric' : 'imperial'
    }
    console.log('DEBUG: Profile data to insert:', profileData)

    // Step 3: Create profile using admin client (bypasses RLS)
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert(profileData)

    if (profileError) {
      console.error('DEBUG: Profile creation error:', profileError)
      return NextResponse.json({ success: false, error: `Failed to create profile: ${profileError.message}` }, { status: 500 })
    }

    console.log('DEBUG: Profile created successfully')

    // Step 4: Create Week 0 baseline data using admin client (bypasses RLS)
    const today = new Date().toISOString().split('T')[0]
    const { error: healthError } = await adminClient
      .from('health_data')
      .insert({
        user_id: userId,
        date: today,
        week_number: 0,
        weight: weightLbs,
        waist: waistInches,
        data_entered_by: 'dr_nick',
        needs_review: false,
        initial_weight: weightLbs
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
    console.error('DEBUG: Unexpected error in create-patient:', err)
    return NextResponse.json({ success: false, error: `Unexpected error: ${err}` }, { status: 500 })
  }
} 