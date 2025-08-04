// src/app/components/health/grokService.ts
// Grok AI analysis service for Dr. Nick's health tracker

import { createClient } from '@supabase/supabase-js'

// Create supabase client directly (same pattern as API routes)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface GrokSettings {
  prompt: string
  temperature: number
}

export interface GrokDataPackage {
  patient_profile: {
    full_name: string
    email: string
    height: number | null
    protein_goal_grams: number | null
    weight_change_goal_percent: number | null
    created_date: string
  }
  current_week: {
    week_number: number
    submission_date: string
    weight: number | null
    waist: number | null
    purposeful_exercise_days: number | null
    symptom_tracking_days: number | null
    detailed_symptom_notes: string | null
    poor_recovery_days: number | null
    sleep_consistency_score: number | null
    nutrition_compliance_days: number | null
    energetic_constraints_reduction_ok: boolean | null
    patient_notes: string | null
  }
  historical_data: Array<{
    week_number: number
    date: string
    weight: number | null
    waist: number | null
    purposeful_exercise_days: number | null
    symptom_tracking_days: number | null
    detailed_symptom_notes: string | null
    poor_recovery_days: number | null
    sleep_consistency_score: number | null
    nutrition_compliance_days: number | null
    patient_notes: string | null
  }>
  current_week_analysis: {
    weekly_whoop_analysis: string | null
    monthly_whoop_analysis: string | null
  }
  monday_message: {
    message_content: string | null
    generated_date: string | null
  }
  calculated_metrics: {
    total_weight_loss_percentage: number | null
    weekly_weight_loss_percentage: number | null
    plateau_prevention_rate: number | null
    weeks_of_data: number
    baseline_weight: number | null
    current_trend: string
  }
}

// Get active global Grok prompt
export async function getActiveGrokPrompt(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('ai')
      .select('prompt_content')
      .eq('prompt_type', 'grok_analysis')
      .eq('is_active', true)
      .single()
    
    if (error) {
      console.error('Error loading Grok prompt:', error)
      return 'Please analyze this patient\'s health data and provide actionable recommendations.'
    }
    
    return data?.prompt_content || 'Please analyze this patient\'s health data and provide actionable recommendations.'
  } catch (err) {
    console.error('Failed to load Grok prompt:', err)
    return 'Please analyze this patient\'s health data and provide actionable recommendations.'
  }
}

// Update global Grok prompt
export async function updateGlobalGrokPrompt(content: string): Promise<void> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Deactivate current prompt
    await supabase
      .from('ai')
      .update({ is_active: false })
      .eq('prompt_type', 'grok_analysis')
      .eq('is_active', true)
    
    // Get next version number
    const { data: versionData } = await supabase
      .from('ai')
      .select('version_number')
      .eq('prompt_type', 'grok_analysis')
      .order('version_number', { ascending: false })
      .limit(1)
    
    const nextVersion = (versionData?.[0]?.version_number || 0) + 1
    
    // Create new active prompt
    const { error } = await supabase
      .from('ai')
      .insert({
        prompt_type: 'grok_analysis',
        prompt_title: 'Grok Health Analysis',
        prompt_content: content,
        is_active: true,
        version_number: nextVersion,
        created_by: user.id
      })
    
    if (error) throw error
  } catch (err) {
    console.error('Failed to update global Grok prompt:', err)
    throw err
  }
}

// Get active global Grok settings (prompt + temperature)
export async function getActiveGrokSettings(): Promise<GrokSettings> {
  try {
    const { data, error } = await supabase
      .from('ai')
      .select('prompt_content, temperature')
      .eq('prompt_type', 'grok_analysis')
      .eq('is_active', true)
      .single()
    
    if (error) {
      console.error('Error loading Grok settings:', error)
      return {
        prompt: 'Please analyze this patient\'s health data and provide actionable recommendations.',
        temperature: 0.3
      }
    }
    
    return {
      prompt: data?.prompt_content || 'Please analyze this patient\'s health data and provide actionable recommendations.',
      temperature: data?.temperature || 0.3
    }
  } catch (err) {
    console.error('Failed to load Grok settings:', err)
    return {
      prompt: 'Please analyze this patient\'s health data and provide actionable recommendations.',
      temperature: 0.3
    }
  }
}

// Update global Grok settings (prompt + temperature)
export async function updateGlobalGrokSettings(content: string, temperature: number): Promise<void> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Deactivate current settings
    await supabase
      .from('ai')
      .update({ is_active: false })
      .eq('prompt_type', 'grok_analysis')
      .eq('is_active', true)
    
    // Get next version number
    const { data: versionData } = await supabase
      .from('ai')
      .select('version_number')
      .eq('prompt_type', 'grok_analysis')
      .order('version_number', { ascending: false })
      .limit(1)
    
    const nextVersion = (versionData?.[0]?.version_number || 0) + 1
    
    // Create new active settings record
    const { error } = await supabase
      .from('ai')
      .insert({
        prompt_type: 'grok_analysis',
        prompt_title: 'Grok Health Analysis',
        prompt_content: content,
        temperature: temperature,
        is_active: true,
        version_number: nextVersion,
        created_by: user.id
      })
    
    if (error) throw error
  } catch (err) {
    console.error('Failed to update global Grok settings:', err)
    throw err
  }
}

// Save Grok analysis response
export async function saveGrokAnalysisResponse(submissionId: string, response: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('health_data')
      .update({ 
        grok_analysis_response: response,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
    
    if (error) throw error
  } catch (err) {
    console.error('Failed to save Grok analysis response:', err)
    throw err
  }
}

// Build comprehensive data package for Grok analysis
export async function buildGrokDataPackage(submissionId: string, userId: string, submissionData?: any): Promise<GrokDataPackage> {
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

    // Get additional profile data using proven working patterns (3 separate queries)
    const profileData = {
      full_name: 'Patient',
      email: 'unknown@email.com',
      height: null,
      protein_goal_grams: null,
      weight_change_goal_percent: null,
      created_at: null
    }

    try {
      // Query 1: Basic profile info (mirrors successful dashboard pattern)
      const { data: basicProfile } = await supabase
        .from('profiles')
        .select('full_name, email, created_at')
        .eq('id', userId)
        .single()
      
      if (basicProfile) {
        profileData.full_name = basicProfile.full_name || 'Patient'
        profileData.email = basicProfile.email || 'unknown@email.com'
        profileData.created_at = basicProfile.created_at
      }

      // Query 2: Weight change goal (mirrors ChartsDashboard.tsx pattern)
      const { data: goalData } = await supabase
        .from('profiles')
        .select('weight_change_goal_percent')
        .eq('id', userId)
        .single()
      
      if (goalData) {
        profileData.weight_change_goal_percent = goalData.weight_change_goal_percent
      }

      // Query 3: Physical metrics (mirrors metricsService.ts pattern)
      const { data: physicalData } = await supabase
        .from('profiles')
        .select('height, protein_goal_grams')
        .eq('id', userId)
        .single()
      
      if (physicalData) {
        profileData.height = physicalData.height
        profileData.protein_goal_grams = physicalData.protein_goal_grams
      }

      console.log('✅ Profile data loaded successfully:', {
        name: profileData.full_name,
        email: profileData.email,
        height: profileData.height,
        protein_goal: profileData.protein_goal_grams,
        weight_goal: profileData.weight_change_goal_percent
      })

    } catch (profileErr) {
      console.warn('Profile fetch failed, using fallback data:', profileErr)
    }
    
    // Get all historical data for this patient (direct query for server-side context)
    console.log(`Fetching historical data for user: ${userId}`)
    const { data: historicalData, error: historyError } = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })
    
    if (historyError) {
      console.error('Historical data fetch error:', historyError)
      throw new Error(`Failed to load historical data: ${historyError.message}`)
    }
    
    // Get Monday message if exists (direct query)
    let mondayMessage = null
    try {
      console.log(`Fetching Monday message for submission: ${submissionId}`)
      const { data: messageData, error: messageError } = await supabase
        .from('health_data')
        .select('monday_message_content')
        .eq('id', submissionId)
        .single()
      
      if (!messageError && messageData?.monday_message_content) {
        mondayMessage = messageData.monday_message_content
      }
    } catch (err) {
      console.log('No Monday message found for this submission')
    }
    
    // Calculate metrics directly from historical data (avoiding server-side auth issues)
    const calculatedMetrics = {
      total_weight_loss_percentage: null as number | null,
      weekly_weight_loss_percentage: null as number | null,
      plateau_prevention_rate: null as number | null,
      weeks_of_data: historicalData?.length || 0,
      baseline_weight: null as number | null,
      current_trend: 'stable'
    }
    
    if (historicalData && historicalData.length > 0) {
      // Sort data by week number
      const sortedData = [...historicalData].sort((a, b) => a.week_number - b.week_number)
      
      // Find Week 0 (baseline) and most recent week with weight data
      const weekZero = sortedData.find(d => d.week_number === 0 && d.weight)
      const latestWeek = [...sortedData].reverse().find(d => d.weight && d.week_number > 0)
      const secondLatestWeek = [...sortedData].reverse().find(d => 
        d.weight && d.week_number > 0 && d.week_number < (latestWeek?.week_number || 0)
      )

      calculatedMetrics.baseline_weight = weekZero?.weight ? parseFloat(weekZero.weight.toString()) : null

      // Calculate Total Weight Loss %
      if (weekZero?.weight && latestWeek?.weight) {
        const baselineWeight = parseFloat(weekZero.weight.toString())
        const currentWeight = parseFloat(latestWeek.weight.toString())
        const weightLoss = baselineWeight - currentWeight
        calculatedMetrics.total_weight_loss_percentage = Math.round((weightLoss / baselineWeight) * 100 * 10) / 10
      }

      // Calculate Week-over-Week Weight Loss %
      if (secondLatestWeek?.weight && latestWeek?.weight) {
        const previousWeight = parseFloat(secondLatestWeek.weight.toString())
        const currentWeight = parseFloat(latestWeek.weight.toString())
        const weeklyLoss = previousWeight - currentWeight
        calculatedMetrics.weekly_weight_loss_percentage = Math.round((weeklyLoss / previousWeight) * 100 * 10) / 10
      }

      // Set plateau prevention rate (same as weekly)
      calculatedMetrics.plateau_prevention_rate = calculatedMetrics.weekly_weight_loss_percentage

      // Determine trend
      if (calculatedMetrics.weekly_weight_loss_percentage && calculatedMetrics.weekly_weight_loss_percentage > 0) {
        calculatedMetrics.current_trend = 'improving'
      } else if (calculatedMetrics.weekly_weight_loss_percentage && calculatedMetrics.weekly_weight_loss_percentage < 0) {
        calculatedMetrics.current_trend = 'declining'
      } else {
        calculatedMetrics.current_trend = 'stable'
      }
    }
    
    // Build the data package
    const dataPackage: GrokDataPackage = {
      patient_profile: {
        full_name: profileData.full_name || 'Patient',
        email: profileData.email || '',
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
      calculated_metrics: calculatedMetrics
    }
    
    return dataPackage
  } catch (err) {
    console.error('Failed to build Grok data package:', err)
    throw err
  }
}

// Format data for Grok (human-readable format)
export function formatDataForGrok(data: GrokDataPackage, prompt: string): string {
  const formatNumber = (num: number | null) => num !== null ? num.toString() : 'N/A'
  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A'
  
  return `PATIENT HEALTH ANALYSIS REQUEST

${prompt}

=== PATIENT PROFILE ===
Name: ${data.patient_profile.full_name}
Email: ${data.patient_profile.email}
Height: ${formatNumber(data.patient_profile.height)} inches
Protein Goal: ${formatNumber(data.patient_profile.protein_goal_grams)} grams
Weight Change Goal: ${formatNumber(data.patient_profile.weight_change_goal_percent)}% weekly
Program Start Date: ${formatDate(data.patient_profile.created_date)}

=== CURRENT WEEK DATA (Week ${data.current_week.week_number}) ===
Submission Date: ${formatDate(data.current_week.submission_date)}
Weight: ${formatNumber(data.current_week.weight)} lbs
Waist: ${formatNumber(data.current_week.waist)} inches
Purposeful Exercise Days: ${formatNumber(data.current_week.purposeful_exercise_days)}/7
Symptom Tracking Days: ${formatNumber(data.current_week.symptom_tracking_days)}/7
Poor Recovery Days: ${formatNumber(data.current_week.poor_recovery_days)}/7
Sleep Consistency Score: ${formatNumber(data.current_week.sleep_consistency_score)}
Nutrition Compliance Days: ${formatNumber(data.current_week.nutrition_compliance_days)}/7
Energetic Constraints Reduction OK: ${data.current_week.energetic_constraints_reduction_ok ? 'Yes' : 'No'}
Patient Notes: ${data.current_week.patient_notes || 'None'}
Detailed Symptom Notes: ${data.current_week.detailed_symptom_notes || 'None'}

=== HISTORICAL PROGRESSION ===
${data.historical_data
  .sort((a, b) => a.week_number - b.week_number)
  .map(entry => 
    `Week ${entry.week_number}: Weight ${formatNumber(entry.weight)} lbs, Waist ${formatNumber(entry.waist)} inches, Exercise ${formatNumber(entry.purposeful_exercise_days)}/7, Symptoms ${formatNumber(entry.symptom_tracking_days)}/7, Sleep Score ${formatNumber(entry.sleep_consistency_score)}, Nutrition ${formatNumber(entry.nutrition_compliance_days)}/7`
  ).join('\n')}

=== DR. NICK'S CURRENT ANALYSIS ===
Weekly Whoop Analysis: ${data.current_week_analysis.weekly_whoop_analysis || 'Not available'}
Monthly Whoop Analysis: ${data.current_week_analysis.monthly_whoop_analysis || 'Not available'}

=== MONDAY MORNING MESSAGE ===
${data.monday_message.message_content || 'Not generated yet'}

=== CALCULATED METRICS ===
Total Weight Loss: ${formatNumber(data.calculated_metrics.total_weight_loss_percentage)}%
Weekly Loss Rate: ${formatNumber(data.calculated_metrics.weekly_weight_loss_percentage)}%
Plateau Prevention Rate: ${formatNumber(data.calculated_metrics.plateau_prevention_rate)}%
Weeks of Data: ${data.calculated_metrics.weeks_of_data}
Baseline Weight: ${formatNumber(data.calculated_metrics.baseline_weight)} lbs
Current Trend: ${data.calculated_metrics.current_trend}

PLEASE ANALYZE AND PROVIDE RECOMMENDATIONS FOLLOWING THE EXACT FORMAT PROVIDED IN THE PROMPT.`
} 