// src/app/components/health/healthService.ts
// Enhanced service for week-based tracking with charts support

import { supabase } from '../auth/AuthContext'

// TypeScript interface for weekly check-in data
export interface WeeklyCheckin {
  id?: string
  user_id?: string
  date: string
  week_number: number
  weight?: number | null
  waist?: number | null
  resistance_training_days?: number | null
  focal_heart_rate_training?: string | null
  hunger_days?: number | null
  poor_recovery_days?: number | null
  sleep_consistency_score?: number | null
  initial_weight?: number | null
  data_entered_by?: string
  created_at?: string
  updated_at?: string
}

// TypeScript interface for form data (patient entries)
export interface CheckinFormData {
  date: string
  week_number: string
  weight?: string
  waist?: string
  resistance_training_days?: string
  focal_heart_rate_training?: string
  hunger_days?: string
  poor_recovery_days?: string
  notes?: string
  // Lumen images (required)
  lumen_day1_image?: string
  lumen_day2_image?: string
  lumen_day3_image?: string
  lumen_day4_image?: string
  lumen_day5_image?: string
  lumen_day6_image?: string
  lumen_day7_image?: string
  // Food log images (optional)
  food_log_day1_image?: string
  food_log_day2_image?: string
  food_log_day3_image?: string
  food_log_day4_image?: string
  food_log_day5_image?: string
  food_log_day6_image?: string
  food_log_day7_image?: string
  // Queue system fields - Weekly
  weekly_whoop_pdf_url?: string
  weekly_whoop_analysis?: string
  weekly_ai_analysis?: string
  weekly_whoop_pdf?: string
  // Queue system fields - Monthly
  monthly_whoop_pdf_url?: string
  monthly_whoop_analysis?: string
  monthly_ai_analysis?: string
  monthly_whoop_pdf?: string
  // Queue management
  needs_review?: boolean
}

// TypeScript interface for Dr. Nick's initial setup
export interface InitialSetupData {
  date: string
  initial_weight: string
  sleep_consistency_score?: string
}

// TypeScript interface for Dr. Nick's weekly updates
export interface DrNickUpdateData {
  week_number: string
  sleep_consistency_score?: string
}

// Function to save patient weekly check-in
export async function saveWeeklyCheckin(data: CheckinFormData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    // Convert string inputs to appropriate types
    const checkinData: any = {
      user_id: user.id,
      date: data.date,
      week_number: parseInt(data.week_number),
      weight: data.weight ? parseFloat(data.weight) : null,
      waist: data.waist ? parseFloat(data.waist) : null,
      resistance_training_days: data.resistance_training_days ? parseInt(data.resistance_training_days) : null,
      focal_heart_rate_training: data.focal_heart_rate_training || null,
      hunger_days: data.hunger_days ? parseInt(data.hunger_days) : null,
      poor_recovery_days: data.poor_recovery_days ? parseInt(data.poor_recovery_days) : null,
      data_entered_by: 'patient',
      // Lumen images
      lumen_day1_image: data.lumen_day1_image || null,
      lumen_day2_image: data.lumen_day2_image || null,
      lumen_day3_image: data.lumen_day3_image || null,
      lumen_day4_image: data.lumen_day4_image || null,
      lumen_day5_image: data.lumen_day5_image || null,
      lumen_day6_image: data.lumen_day6_image || null,
      lumen_day7_image: data.lumen_day7_image || null,
      // Food log images
      food_log_day1_image: data.food_log_day1_image || null,
      food_log_day2_image: data.food_log_day2_image || null,
      food_log_day3_image: data.food_log_day3_image || null,
      food_log_day4_image: data.food_log_day4_image || null,
      food_log_day5_image: data.food_log_day5_image || null,
      food_log_day6_image: data.food_log_day6_image || null,
      food_log_day7_image: data.food_log_day7_image || null,
      // Queue system fields - Weekly
      weekly_whoop_pdf_url: data.weekly_whoop_pdf_url || null,
      weekly_whoop_analysis: data.weekly_whoop_analysis || null,
      weekly_ai_analysis: data.weekly_ai_analysis || null,
      weekly_whoop_pdf: data.weekly_whoop_pdf || null,
      // Queue system fields - Monthly
      monthly_whoop_pdf_url: data.monthly_whoop_pdf_url || null,
      monthly_whoop_analysis: data.monthly_whoop_analysis || null,
      monthly_ai_analysis: data.monthly_ai_analysis || null,
      monthly_whoop_pdf: data.monthly_whoop_pdf || null,
      // Queue management - set to true when patient submits
      needs_review: true,
    }

    // Check if record already exists for this week
    const { data: existingRecord } = await supabase
      .from('health_data')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_number', parseInt(data.week_number))
      .eq('data_entered_by', 'patient')
      .single()

    let result

    if (existingRecord) {
      // Update existing record
      result = await supabase
        .from('health_data')
        .update({
          ...checkinData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select()
    } else {
      // Insert new record
      result = await supabase
        .from('health_data')
        .insert(checkinData)
        .select()
    }

    return result
  } catch (error) {
    console.error('Error saving weekly check-in:', error)
    return { data: null, error }
  }
}

// Function to save Dr. Nick's initial setup (Week 0)
export async function saveInitialSetup(data: InitialSetupData, patientUserId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const setupData: Partial<WeeklyCheckin> = {
      user_id: patientUserId,
      date: data.date,
      week_number: 0,
      initial_weight: parseFloat(data.initial_weight),
      weight: parseFloat(data.initial_weight), // Starting weight
      sleep_consistency_score: data.sleep_consistency_score ? parseInt(data.sleep_consistency_score) : null,
      data_entered_by: 'dr_nick',
    }

    // Check if Week 0 already exists
    const { data: existingRecord } = await supabase
      .from('health_data')
      .select('id')
      .eq('user_id', patientUserId)
      .eq('week_number', 0)
      .single()

    let result

    if (existingRecord) {
      // Update existing Week 0 record
      result = await supabase
        .from('health_data')
        .update({
          ...setupData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select()
    } else {
      // Insert new Week 0 record
      result = await supabase
        .from('health_data')
        .insert(setupData)
        .select()
    }

    return result
  } catch (error) {
    console.error('Error saving initial setup:', error)
    return { data: null, error }
  }
}

// Function to update sleep scores by Dr. Nick
export async function updateSleepScore(data: DrNickUpdateData, patientUserId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    // Find existing record for this week
    const { data: existingRecord } = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', patientUserId)
      .eq('week_number', parseInt(data.week_number))
      .single()

    if (existingRecord) {
      // Update existing record with sleep score
      const result = await supabase
        .from('health_data')
        .update({
          sleep_consistency_score: data.sleep_consistency_score ? parseInt(data.sleep_consistency_score) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select()

      return result
    } else {
      // Create new record with just sleep score
      const sleepData: Partial<WeeklyCheckin> = {
        user_id: patientUserId,
        date: new Date().toISOString().split('T')[0],
        week_number: parseInt(data.week_number),
        sleep_consistency_score: data.sleep_consistency_score ? parseInt(data.sleep_consistency_score) : null,
        data_entered_by: 'dr_nick',
      }

      const result = await supabase
        .from('health_data')
        .insert(sleepData)
        .select()

      return result
    }
  } catch (error) {
    console.error('Error updating sleep score:', error)
    return { data: null, error }
  }
}

// Function to get all weekly data for charts
export async function getWeeklyDataForCharts(patientUserId?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    // Use provided patient ID or current user ID
    const userId = patientUserId || user.id

    const result = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })

    return result
  } catch (error) {
    console.error('Error fetching weekly data for charts:', error)
    return { data: null, error }
  }
}

// Function to get check-in for a specific week
export async function getCheckinForWeek(weekNumber: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const result = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_number', weekNumber)
      .eq('data_entered_by', 'patient')
      .single()

    return result
  } catch (error) {
    console.error('Error fetching check-in for week:', error)
    return { data: null, error }
  }
}

// Helper function to calculate loss percentage rate
export function calculateLossPercentageRate(currentWeight: number, previousWeight: number): number {
  if (!previousWeight || previousWeight === 0) return 0
  return Math.abs(100 - (currentWeight / previousWeight) * 100)
}

// Function to update a specific health record (for Dr. Nick's editable table)
export async function updateHealthRecord(recordId: string, updates: Partial<WeeklyCheckin>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    // Prepare the update data with proper type conversion
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Convert and validate each field
    if (updates.date !== undefined) updateData.date = updates.date
    if (updates.weight !== undefined) updateData.weight = updates.weight ? parseFloat(String(updates.weight)) : null
    if (updates.waist !== undefined) updateData.waist = updates.waist ? parseFloat(String(updates.waist)) : null
    if (updates.resistance_training_days !== undefined) updateData.resistance_training_days = updates.resistance_training_days ? parseInt(String(updates.resistance_training_days)) : null
    if (updates.focal_heart_rate_training !== undefined) updateData.focal_heart_rate_training = updates.focal_heart_rate_training || null
    if (updates.hunger_days !== undefined) updateData.hunger_days = updates.hunger_days ? parseInt(String(updates.hunger_days)) : null
    if (updates.poor_recovery_days !== undefined) updateData.poor_recovery_days = updates.poor_recovery_days ? parseInt(String(updates.poor_recovery_days)) : null
    if (updates.sleep_consistency_score !== undefined) updateData.sleep_consistency_score = updates.sleep_consistency_score ? parseInt(String(updates.sleep_consistency_score)) : null
    if (updates.initial_weight !== undefined) updateData.initial_weight = updates.initial_weight ? parseFloat(String(updates.initial_weight)) : null

    const result = await supabase
      .from('health_data')
      .update(updateData)
      .eq('id', recordId)
      .select()

    return result
  } catch (error) {
    console.error('Error updating health record:', error)
    return { data: null, error }
  }
}

// Function to delete a health record (for Dr. Nick's editable table)
export async function deleteHealthRecord(recordId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const result = await supabase
      .from('health_data')
      .delete()
      .eq('id', recordId)

    return result
  } catch (error) {
    console.error('Error deleting health record:', error)
    return { data: null, error }
  }
}

// Helper function to generate weight loss projections
export function generateWeightProjections(initialWeight: number, weeks: number = 16) {
  const projectionRates = [0.5, 1.0, 1.5, 2.0] // Fat loss percentages
  
  return projectionRates.map(rate => {
    const projection = []
    let currentWeight = initialWeight
    
    // Week 0
    projection.push({ week: 0, weight: currentWeight })
    
    // Weeks 1-16
    for (let week = 1; week <= weeks; week++) {
      currentWeight = currentWeight - (currentWeight * (rate / 100))
      projection.push({ week, weight: Math.round(currentWeight * 10) / 10 })
    }
    
    return {
      rate: `${rate}%`,
      data: projection
    }
  })
}

// ============================================================================
// QUEUE SYSTEM FUNCTIONS
// ============================================================================

// Get all submissions that need review (for Dr. Nick's queue)
export async function getSubmissionsNeedingReview() {
  try {
    // First check if the new fields exist, if not return mock data for testing
    const { data: testData, error: testError } = await supabase
      .from('health_data')
      .select('needs_review')
      .limit(1)

    if (testError && testError.message.includes('column "needs_review" does not exist')) {
      console.log('Queue system fields not yet migrated. Returning mock data for testing.')
      
      // Get recent patient submissions for testing the queue interface
      const { data: mockData, error: mockError } = await supabase
        .from('health_data')
        .select(`
          *,
          profiles!user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('data_entered_by', 'patient')
        .order('created_at', { ascending: false })
        .limit(5)

      if (mockError) {
        console.error('Error fetching mock data:', mockError)
        return { data: [], error: null }
      }

      // Transform the data to match the expected format
      const transformedData = (mockData || []).map(item => ({
        ...item,
        needs_review: true, // Mock the needs_review field
        profiles: {
          id: item.profiles?.id,
          email: item.profiles?.email,
          first_name: item.profiles?.full_name?.split(' ')[0] || '',
          last_name: item.profiles?.full_name?.split(' ').slice(1).join(' ') || ''
        }
      }))

      return { data: transformedData, error: null }
    }

    const result = await supabase
      .from('health_data')
      .select(`
        *,
        profiles!user_id (
          id,
          email,
          full_name
        )
      `)
      .eq('needs_review', true)
      .eq('data_entered_by', 'patient')
      .order('created_at', { ascending: true }) // First submitted, first in queue

    // Transform the data to match the expected format
    if (result.data) {
      result.data = result.data.map(item => ({
        ...item,
        profiles: {
          id: item.profiles?.id,
          email: item.profiles?.email,
          first_name: item.profiles?.full_name?.split(' ')[0] || '',
          last_name: item.profiles?.full_name?.split(' ').slice(1).join(' ') || ''
        }
      }))
    }

    return result
  } catch (error) {
    console.error('Error fetching submissions needing review:', error)
    return { data: null, error }
  }
}

// Mark a submission as reviewed (remove from queue)
export async function markSubmissionAsReviewed(submissionId: string) {
  try {
    const result = await supabase
      .from('health_data')
      .update({ 
        needs_review: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()

    return result
  } catch (error) {
    console.error('Error marking submission as reviewed:', error)
    return { data: null, error }
  }
}

// Update Dr. Nick's analysis for a submission
export async function updateDrNickAnalysis(
  submissionId: string, 
  analysisData: {
    weekly_whoop_pdf_url?: string
    weekly_whoop_analysis?: string
    weekly_whoop_pdf?: string
    monthly_whoop_pdf_url?: string
    monthly_whoop_analysis?: string
    monthly_whoop_pdf?: string
  }
) {
  try {
    const result = await supabase
      .from('health_data')
      .update({
        ...analysisData,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()

    return result
  } catch (error) {
    console.error('Error updating Dr. Nick analysis:', error)
    return { data: null, error }
  }
}

// Get a specific submission with all details (for queue review)
export async function getSubmissionDetails(submissionId: string) {
  try {
    const result = await supabase
      .from('health_data')
      .select(`
        *,
        users!health_data_user_id_fkey (
          id,
          email,
          first_name,
          last_name,
          week1_start_date
        )
      `)
      .eq('id', submissionId)
      .single()

    return result
  } catch (error) {
    console.error('Error fetching submission details:', error)
    return { data: null, error }
  }
}