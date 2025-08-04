// src/app/api/grok/analyze/route.ts
// API endpoint for Grok AI analysis

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatDataForGrok, saveGrokAnalysisResponse, GrokDataPackage } from '../../../components/health/grokService'

// Type definition for health data record
interface HealthDataRecord {
  id: string
  user_id: string
  week_number: number
  date?: string
  created_at?: string
  weight?: number
  waist?: number
  purposeful_exercise_days?: number
  symptom_tracking_days?: number
  detailed_symptom_notes?: string
  poor_recovery_days?: number
  sleep_consistency_score?: number
  nutrition_compliance_days?: number
  energetic_constraints_reduction_ok?: boolean
  notes?: string
  weekly_whoop_analysis?: string
  monthly_whoop_analysis?: string
  [key: string]: any
}

// ============================================================================
// API-SPECIFIC DATA FETCHING FUNCTIONS
// ============================================================================

// API version of getWeeklyDataForCharts
async function getWeeklyDataForChartsAPI(userId: string, supabaseClient: any) {
  try {
    const result = await supabaseClient
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })

    return result
  } catch (error) {
    console.error('Error fetching weekly data for charts (API):', error)
    return { data: null, error: error instanceof Error ? error : new Error('Unknown error') }
  }
}

// API version of getPatientMetrics
async function getPatientMetricsAPI(userId: string, supabaseClient: any) {
  try {
    const { data: historicalData, error: historyError } = await supabaseClient
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })
    
    if (historyError) {
      console.error('Historical data fetch error:', historyError)
      throw new Error(`Failed to load historical data: ${historyError.message}`)
    }
    
    // Calculate metrics from historical data
    const calculations = {
      totalWeightLossPercentage: null as number | null,
      weeklyWeightLossPercentage: null as number | null,
      dataPoints: historicalData?.length || 0,
      hasEnoughData: false
    }
    
    if (historicalData && historicalData.length >= 2) {
      const sortedData = historicalData.sort((a: HealthDataRecord, b: HealthDataRecord) => a.week_number - b.week_number)
      const firstEntry = sortedData[0]
      const lastEntry = sortedData[sortedData.length - 1]
      
      if (firstEntry.weight && lastEntry.weight) {
        const initialWeight = firstEntry.weight
        const currentWeight = lastEntry.weight
        const weightLoss = initialWeight - currentWeight
        
        calculations.totalWeightLossPercentage = (weightLoss / initialWeight) * 100
        calculations.hasEnoughData = true
        
        // Calculate weekly loss rate
        const weeksDiff = lastEntry.week_number - firstEntry.week_number
        if (weeksDiff > 0) {
          calculations.weeklyWeightLossPercentage = calculations.totalWeightLossPercentage / weeksDiff
        }
      }
    }
    
    return calculations
  } catch (error) {
    console.error('Error calculating patient metrics (API):', error)
    return {
      totalWeightLossPercentage: null,
      weeklyWeightLossPercentage: null,
      dataPoints: 0,
      hasEnoughData: false
    }
  }
}

// API version of getPatientProfile
async function getPatientProfileAPI(userId: string, supabaseClient: any) {
  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (profileError) {
      console.error('Profile fetch error:', profileError)
      throw new Error(`Failed to load profile: ${profileError.message}`)
    }
    
    return profileData || {
      full_name: 'Patient',
      email: 'unknown@email.com',
      height: null,
      protein_goal_grams: null,
      weight_change_goal_percent: null,
      created_at: null
    }
  } catch (error) {
    console.error('Error fetching patient profile (API):', error)
    return {
      full_name: 'Patient',
      email: 'unknown@email.com',
      height: null,
      protein_goal_grams: null,
      weight_change_goal_percent: null,
      created_at: null
    }
  }
}

// API version of getMondayMessage
async function getMondayMessageAPI(submissionId: string, supabaseClient: any) {
  try {
    const { data: messageData, error: messageError } = await supabaseClient
      .from('health_data')
      .select('monday_message_content')
      .eq('id', submissionId)
      .single()
    
    if (messageError) {
      console.log('Monday message fetch error:', messageError)
      return null
    }
    
    return messageData?.monday_message_content || null
  } catch (error) {
    console.error('Error fetching Monday message (API):', error)
    return null
  }
}

// API version of buildGrokDataPackage - uses all API functions above
async function buildGrokDataPackageAPI(submissionId: string, userId: string, submissionData: HealthDataRecord, supabaseClient: any): Promise<GrokDataPackage> {
  try {
    console.log(`Processing submission for user ${userId}, week ${submissionData.week_number}`)

    // Get patient profile data using API function
    console.log('Fetching patient profile...')
    const profileData = await getPatientProfileAPI(userId, supabaseClient)
    console.log('✅ Profile data loaded successfully:', {
      name: profileData.full_name,
      email: profileData.email,
      height: profileData.height,
      protein_goal: profileData.protein_goal_grams,
      weight_goal: profileData.weight_change_goal_percent
    })
    
    // Get all historical data for this patient using API function
    console.log(`Fetching historical data for user: ${userId}`)
    const { data: historicalData, error: historyError } = await getWeeklyDataForChartsAPI(userId, supabaseClient)
    
    if (historyError) {
      console.error('Historical data fetch error:', historyError)
      throw new Error(`Failed to load historical data: ${historyError.message}`)
    }
    
    console.log(`✅ Historical data loaded: ${historicalData?.length || 0} records`)
    
    // Get Monday message using API function
    console.log(`Fetching Monday message for submission: ${submissionId}`)
    const mondayMessage = await getMondayMessageAPI(submissionId, supabaseClient)
    console.log(mondayMessage ? '✅ Monday message loaded' : 'ℹ️ No Monday message found')
    
    // Calculate metrics using API function
    console.log('Calculating patient metrics...')
    const calculatedMetrics = await getPatientMetricsAPI(userId, supabaseClient)
    console.log('✅ Metrics calculated:', {
      totalLoss: calculatedMetrics.totalWeightLossPercentage,
      weeklyLoss: calculatedMetrics.weeklyWeightLossPercentage,
      dataPoints: calculatedMetrics.dataPoints,
      hasEnoughData: calculatedMetrics.hasEnoughData
    })
    
    // Build the data package
    const dataPackage: GrokDataPackage = {
      patient_profile: {
        full_name: profileData.full_name,
        email: profileData.email,
        height: profileData.height,
        protein_goal_grams: profileData.protein_goal_grams,
        weight_change_goal_percent: profileData.weight_change_goal_percent,
        created_date: profileData.created_at || ''
      },
      current_week: {
        week_number: submissionData.week_number,
        submission_date: submissionData.date || submissionData.created_at || '',
        weight: submissionData.weight || null,
        waist: submissionData.waist || null,
        purposeful_exercise_days: submissionData.purposeful_exercise_days || null,
        symptom_tracking_days: submissionData.symptom_tracking_days || null,
        detailed_symptom_notes: submissionData.detailed_symptom_notes || null,
        poor_recovery_days: submissionData.poor_recovery_days || null,
        sleep_consistency_score: submissionData.sleep_consistency_score || null,
        nutrition_compliance_days: submissionData.nutrition_compliance_days || null,
        energetic_constraints_reduction_ok: submissionData.energetic_constraints_reduction_ok || null,
        patient_notes: submissionData.notes || null
      },
      historical_data: (historicalData || []).map((entry: HealthDataRecord) => ({
        week_number: entry.week_number,
        date: entry.date || entry.created_at || '',
        weight: entry.weight || null,
        waist: entry.waist || null,
        purposeful_exercise_days: entry.purposeful_exercise_days || null,
        symptom_tracking_days: entry.symptom_tracking_days || null,
        detailed_symptom_notes: entry.detailed_symptom_notes || null,
        poor_recovery_days: entry.poor_recovery_days || null,
        sleep_consistency_score: entry.sleep_consistency_score || null,
        nutrition_compliance_days: entry.nutrition_compliance_days || null,
        patient_notes: entry.notes || null
      })),
      current_week_analysis: {
        weekly_whoop_analysis: submissionData.weekly_whoop_analysis || null,
        monthly_whoop_analysis: submissionData.monthly_whoop_analysis || null
      },
      monday_message: {
        message_content: mondayMessage,
        generated_date: mondayMessage ? new Date().toISOString() : null
      },
      calculated_metrics: {
        total_weight_loss_percentage: calculatedMetrics.totalWeightLossPercentage,
        weekly_weight_loss_percentage: calculatedMetrics.weeklyWeightLossPercentage,
        plateau_prevention_rate: calculatedMetrics.weeklyWeightLossPercentage, // Same as weekly
        weeks_of_data: calculatedMetrics.dataPoints,
        baseline_weight: historicalData?.find((d: HealthDataRecord) => d.week_number === 0)?.weight || null,
        current_trend: calculatedMetrics.weeklyWeightLossPercentage && calculatedMetrics.weeklyWeightLossPercentage > 0 ? 'improving' : 
                      calculatedMetrics.weeklyWeightLossPercentage && calculatedMetrics.weeklyWeightLossPercentage < 0 ? 'declining' : 'stable'
      }
    }
    
    return dataPackage
  } catch (err) {
    console.error('Failed to build Grok data package (API):', err)
    throw err
  }
}

// ============================================================================
// MAIN API ROUTE
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.split(' ')[1]
    
    // Create Supabase client with anon key initially for user verification
    const verificationClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Verify the JWT token
    const { data: { user }, error: userError } = await verificationClient.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user is Dr. Nick
    if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
    // CRITICAL FIX: Create a new authenticated Supabase client for database operations
    // This client will be properly authenticated as Dr. Nick for all database queries
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    // Parse request body
    const { submissionId, userId, customPrompt, temperature } = await request.json()
    
    if (!submissionId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }
    
    // First, get the submission data to pass to buildGrokDataPackage
    console.log('Fetching submission data...')
    const { data: submissionData, error: submissionError } = await supabase
      .from('health_data')
      .select('*')
      .eq('id', submissionId)
    
    if (submissionError) {
      console.error('Failed to fetch submission:', submissionError)
      return NextResponse.json({ 
        error: `Failed to fetch submission: ${submissionError.message}` 
      }, { status: 400 })
    }

    if (!submissionData || submissionData.length === 0) {
      console.error('No submission found with ID:', submissionId)
      return NextResponse.json({ 
        error: 'Submission not found' 
      }, { status: 404 })
    }

    // Build comprehensive data package using NEW API function
    console.log('Building data package for Grok analysis...')
    const dataPackage = await buildGrokDataPackageAPI(submissionId, userId, submissionData[0], supabase)
    
    // Format data for Grok
    const prompt = customPrompt || 'Please analyze this patient\'s health data and provide actionable recommendations.'
    const formattedData = formatDataForGrok(dataPackage, prompt)
    
    // Create audit payload for debugging (prompt + data package)
    const auditPayload = `=== GROK ANALYSIS AUDIT TRAIL ===
Timestamp: ${new Date().toISOString()}
Submission ID: ${submissionId}
User ID: ${userId}
Model: ${process.env.GROK_MODEL || 'grok-3-latest'}
Temperature: ${temperature || 0.3}
Max Tokens: 4000

=== CUSTOM PROMPT ===
${prompt}

=== FORMATTED DATA SENT TO GROK ===
${formattedData}

=== RAW DATA PACKAGE ===
${JSON.stringify(dataPackage, null, 2)}
`
    
    // Call Grok API
    console.log('Sending request to Grok API...')
    const grokResponse = await fetch(`${process.env.GROK_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: formattedData
          }
        ],
        model: process.env.GROK_MODEL || 'grok-3-latest',
        stream: false,
        temperature: temperature || 0.3, // Use custom temperature or default to 0.3
        max_tokens: 4000 // Ensure we get comprehensive responses
      })
    })
    
    if (!grokResponse.ok) {
      const errorText = await grokResponse.text()
      console.error('Grok API error:', errorText)
      return NextResponse.json({ 
        error: `Grok API error: ${grokResponse.status} - ${errorText}` 
      }, { status: 500 })
    }
    
    const grokData = await grokResponse.json()
    
    // Extract the analysis from Grok's response
    const analysis = grokData.choices?.[0]?.message?.content
    
    if (!analysis) {
      console.error('No analysis content in Grok response:', grokData)
      return NextResponse.json({ 
        error: 'No analysis received from Grok' 
      }, { status: 500 })
    }
    
    // Save the analysis response to database
    console.log('Saving Grok analysis to database...')
    await saveGrokAnalysisResponse(submissionId, analysis)
    
    // Save audit payload to database for debugging
    console.log('Saving audit payload to database...')
    const { error: auditError } = await supabase
      .from('health_data')
      .update({ grok_audit_payload: auditPayload })
      .eq('id', submissionId)
    
    if (auditError) {
      console.error('Failed to save audit payload:', auditError)
      // Don't fail the entire request if audit save fails
    }
    
    console.log('Grok analysis completed successfully')
    return NextResponse.json({ 
      success: true, 
      analysis: analysis,
      tokensUsed: grokData.usage?.total_tokens || 0
    })
    
  } catch (error) {
    console.error('Grok analysis error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
} 