// src/app/api/grok/analyze/route.ts
// API endpoint for Grok AI analysis

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatDataForGrok, saveGrokAnalysisResponse, GrokDataPackage } from '../../../components/health/grokService'

// Create Supabase client for API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for API routes
)

// ============================================================================
// API-SPECIFIC DATA FETCHING FUNCTIONS (using service role client)
// ============================================================================

// API version of getWeeklyDataForCharts - uses service role client directly
async function getWeeklyDataForChartsAPI(userId: string) {
  try {
    const result = await supabase
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

// API version of getPatientMetrics - uses service role client directly
async function getPatientMetricsAPI(userId: string) {
  try {
    // Get health data using API version
    const { data: healthData, error: healthError } = await getWeeklyDataForChartsAPI(userId)
    
    if (healthError) {
      return {
        totalWeightLossPercentage: null,
        weeklyWeightLossPercentage: null,
        weightChangeGoalPercent: null,
        hasEnoughData: false,
        dataPoints: 0,
        error: typeof healthError === 'string' ? healthError : 'Error fetching health data'
      }
    }

    if (!healthData || healthData.length === 0) {
      return {
        totalWeightLossPercentage: null,
        weeklyWeightLossPercentage: null,
        weightChangeGoalPercent: null,
        hasEnoughData: false,
        dataPoints: 0,
        error: 'No health data found'
      }
    }

    // Fetch weight change goal from profile using service role client
    let weightChangeGoalPercent: number | null = null
    const { data: profileData } = await supabase
      .from('profiles')
      .select('weight_change_goal_percent')
      .eq('id', userId)
      .single()
    
    weightChangeGoalPercent = profileData?.weight_change_goal_percent || 1.0

    // Sort data by week number to ensure proper calculation
    const sortedData = [...healthData].sort((a, b) => a.week_number - b.week_number)
    
    // Find Week 0 (baseline) and most recent week with weight data
    const weekZero = sortedData.find(d => d.week_number === 0 && d.weight)
    const latestWeek = [...sortedData].reverse().find(d => d.weight && d.week_number > 0)
    const secondLatestWeek = [...sortedData].reverse().find(d => 
      d.weight && d.week_number > 0 && d.week_number < (latestWeek?.week_number || 0)
    )

    // Calculate Total Weight Loss % (primary KPI)
    let totalWeightLossPercentage: number | null = null
    if (weekZero?.weight && latestWeek?.weight) {
      const weightLoss = weekZero.weight - latestWeek.weight
      totalWeightLossPercentage = Math.round((weightLoss / weekZero.weight) * 100 * 10) / 10 // Round to 1 decimal
    }

    // Calculate Week-over-Week Weight Loss %
    let weeklyWeightLossPercentage: number | null = null
    if (secondLatestWeek?.weight && latestWeek?.weight) {
      const weeklyLoss = secondLatestWeek.weight - latestWeek.weight
      weeklyWeightLossPercentage = Math.round((weeklyLoss / secondLatestWeek.weight) * 100 * 10) / 10 // Round to 1 decimal
    }

    return {
      totalWeightLossPercentage,
      weeklyWeightLossPercentage,
      weightChangeGoalPercent,
      hasEnoughData: sortedData.length >= 2 && !!weekZero, // Need baseline + at least 1 week
      dataPoints: sortedData.length,
      error: null
    }

  } catch (error) {
    console.error('Error calculating patient metrics (API):', error)
    return {
      totalWeightLossPercentage: null,
      weeklyWeightLossPercentage: null,
      weightChangeGoalPercent: null,
      hasEnoughData: false,
      dataPoints: 0,
      error: error instanceof Error ? error.message : 'Error calculating metrics'
    }
  }
}

// API version of profile data fetching - uses service role client directly
async function getPatientProfileAPI(userId: string) {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email, height, protein_goal_grams, weight_change_goal_percent, created_at')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Profile fetch error (API):', profileError)
      return {
        full_name: 'Patient',
        email: 'unknown@email.com',
        height: null,
        protein_goal_grams: null,
        weight_change_goal_percent: null,
        created_at: null
      }
    }

    return {
      full_name: profileData.full_name || 'Patient',
      email: profileData.email || 'unknown@email.com',
      height: profileData.height,
      protein_goal_grams: profileData.protein_goal_grams,
      weight_change_goal_percent: profileData.weight_change_goal_percent,
      created_at: profileData.created_at
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

// API version of Monday message loading - uses service role client directly
async function getMondayMessageAPI(submissionId: string) {
  try {
    const { data: messageData, error: messageError } = await supabase
      .from('health_data')
      .select('monday_message_content')
      .eq('id', submissionId)
      .single()
    
    if (messageError || !messageData?.monday_message_content) {
      return null
    }

    return messageData.monday_message_content
  } catch (error) {
    console.error('Error fetching Monday message (API):', error)
    return null
  }
}

// API version of buildGrokDataPackage - uses all API functions above
async function buildGrokDataPackageAPI(submissionId: string, userId: string, submissionData?: any): Promise<GrokDataPackage> {
  try {
    // Use provided submission data if available, otherwise fetch it
    let currentSubmission = submissionData
    if (!currentSubmission) {
      console.log(`Fetching submission data for ID: ${submissionId}`)
      const { data: fetchedSubmission, error: submissionError } = await supabase
        .from('health_data')
        .select('*')
        .eq('id', submissionId)
        .single()
      
      if (submissionError) {
        console.error('Supabase submission fetch error:', submissionError)
        throw new Error(`Failed to load submission data: ${submissionError.message}`)
      }
      currentSubmission = fetchedSubmission
    }

    if (!currentSubmission) {
      throw new Error('No submission data available after fetch attempt')
    }

    console.log(`Processing submission for user ${userId}, week ${currentSubmission.week_number}`)

    // Get patient profile data using API function
    console.log('Fetching patient profile...')
    const profileData = await getPatientProfileAPI(userId)
    console.log('✅ Profile data loaded successfully:', {
      name: profileData.full_name,
      email: profileData.email,
      height: profileData.height,
      protein_goal: profileData.protein_goal_grams,
      weight_goal: profileData.weight_change_goal_percent
    })
    
    // Get all historical data for this patient using API function
    console.log(`Fetching historical data for user: ${userId}`)
    const { data: historicalData, error: historyError } = await getWeeklyDataForChartsAPI(userId)
    
    if (historyError) {
      console.error('Historical data fetch error:', historyError)
      throw new Error(`Failed to load historical data: ${historyError.message}`)
    }
    
    console.log(`✅ Historical data loaded: ${historicalData?.length || 0} records`)
    
    // Get Monday message using API function
    console.log(`Fetching Monday message for submission: ${submissionId}`)
    const mondayMessage = await getMondayMessageAPI(submissionId)
    console.log(mondayMessage ? '✅ Monday message loaded' : 'ℹ️ No Monday message found')
    
    // Calculate metrics using API function
    console.log('Calculating patient metrics...')
    const calculatedMetrics = await getPatientMetricsAPI(userId)
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
        week_number: currentSubmission.week_number,
        submission_date: currentSubmission.date || currentSubmission.created_at,
        weight: currentSubmission.weight,
        waist: currentSubmission.waist,
        purposeful_exercise_days: currentSubmission.purposeful_exercise_days,
        symptom_tracking_days: currentSubmission.symptom_tracking_days,
        detailed_symptom_notes: currentSubmission.detailed_symptom_notes,
        poor_recovery_days: currentSubmission.poor_recovery_days,
        sleep_consistency_score: currentSubmission.sleep_consistency_score,
        nutrition_compliance_days: currentSubmission.nutrition_compliance_days,
        energetic_constraints_reduction_ok: currentSubmission.energetic_constraints_reduction_ok,
        patient_notes: currentSubmission.notes
      },
      historical_data: (historicalData || []).map(entry => ({
        week_number: entry.week_number,
        date: entry.date || entry.created_at,
        weight: entry.weight,
        waist: entry.waist,
        purposeful_exercise_days: entry.purposeful_exercise_days,
        symptom_tracking_days: entry.symptom_tracking_days,
        detailed_symptom_notes: entry.detailed_symptom_notes,
        poor_recovery_days: entry.poor_recovery_days,
        sleep_consistency_score: entry.sleep_consistency_score,
        nutrition_compliance_days: entry.nutrition_compliance_days,
        patient_notes: entry.notes
      })),
      current_week_analysis: {
        weekly_whoop_analysis: currentSubmission.weekly_whoop_analysis,
        monthly_whoop_analysis: currentSubmission.monthly_whoop_analysis
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
        baseline_weight: historicalData?.find(d => d.week_number === 0)?.weight || null,
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
    
    // Verify the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user is Dr. Nick
    if (user.email !== 'thefittesttribe@gmail.com') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
    // Parse request body
    const { submissionId, userId, customPrompt } = await request.json()
    
    if (!submissionId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }
    
    // First, get the submission data to pass to buildGrokDataPackage
    console.log('Fetching submission data...')
    const { data: submissionData, error: submissionError } = await supabase
      .from('health_data')
      .select('*')
      .eq('id', submissionId)
      .single()
    
    if (submissionError) {
      console.error('Failed to fetch submission:', submissionError)
      return NextResponse.json({ 
        error: `Failed to fetch submission: ${submissionError.message}` 
      }, { status: 400 })
    }

    // Build comprehensive data package using NEW API function
    console.log('Building data package for Grok analysis...')
    const dataPackage = await buildGrokDataPackageAPI(submissionId, userId, submissionData)
    
    // Format data for Grok
    const prompt = customPrompt || 'Please analyze this patient\'s health data and provide actionable recommendations.'
    const formattedData = formatDataForGrok(dataPackage, prompt)
    
    // Create audit payload for debugging (prompt + data package)
    const auditPayload = `=== GROK ANALYSIS AUDIT TRAIL ===
Timestamp: ${new Date().toISOString()}
Submission ID: ${submissionId}
User ID: ${userId}
Model: ${process.env.GROK_MODEL || 'grok-3-latest'}
Temperature: 0.3
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
        temperature: 0.3, // Lower temperature for more consistent medical analysis
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