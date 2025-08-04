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
  symptom_tracking_days?: number | null
  detailed_symptom_notes?: string | null
  purposeful_exercise_days?: number | null
  energetic_constraints_reduction_ok?: boolean | null
  sleep_consistency_score?: number | null
  initial_weight?: number | null
  morning_fat_burn_percent?: number | null
  body_fat_percentage?: number | null
  nutrition_compliance_days?: number | null
  data_entered_by?: string
  needs_review?: boolean | null
  notes?: string | null
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
  symptom_tracking_days?: string
  detailed_symptom_notes?: string
  purposeful_exercise_days?: string
  poor_recovery_days?: string
  notes?: string
  // Energetic constraints question
  energetic_constraints_reduction_ok?: boolean
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
      symptom_tracking_days: data.symptom_tracking_days ? parseInt(data.symptom_tracking_days) : null,
      detailed_symptom_notes: data.detailed_symptom_notes || null,
      purposeful_exercise_days: data.purposeful_exercise_days ? parseInt(data.purposeful_exercise_days) : null,
      poor_recovery_days: data.poor_recovery_days ? parseInt(data.poor_recovery_days) : null,
      energetic_constraints_reduction_ok: data.energetic_constraints_reduction_ok || false,
      data_entered_by: 'patient',
      notes: data.notes || null,
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
      needs_review: false, // Dr. Nick's baseline entries don't need review
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

// Function to check if user has already submitted this week (based on current Monday boundaries)
export async function hasUserSubmittedThisWeek() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { hasSubmitted: false, error: { message: 'User not authenticated' } }
    }

    // Get user's latest submission
    const { data: latestSubmission, error } = await supabase
      .from('health_data')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('data_entered_by', 'patient')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found, which is ok
      console.error('Error fetching latest submission:', error)
      return { hasSubmitted: false, error }
    }

    // If no submissions found, user hasn't submitted this week
    if (!latestSubmission) {
      return { hasSubmitted: false, error: null }
    }

    // Calculate current week boundaries using same UTC+14 logic as submission window
    const now = new Date()
    const firstMondayOffset = 14 * 60 // UTC+14 offset in minutes (Line Islands, Kiribati)
    const firstMondayTime = new Date(now.getTime() + (firstMondayOffset * 60000))
    
    // Get current day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = firstMondayTime.getDay()
    
    // Calculate days since last Monday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Sunday = 6, Monday = 0
    
    // Get the Monday of this week (in UTC+14 timezone)
    const thisMonday = new Date(firstMondayTime)
    thisMonday.setDate(firstMondayTime.getDate() - daysSinceMonday)
    thisMonday.setHours(0, 0, 0, 0)
    
    // Get Thursday of this week (when week ends)
    const thisThursday = new Date(thisMonday)
    thisThursday.setDate(thisMonday.getDate() + 3) // Thursday is 3 days after Monday
    thisThursday.setHours(0, 0, 0, 0)
    
    // Convert boundaries back to UTC for comparison with database timestamps
    const mondayUTC = new Date(thisMonday.getTime() - (firstMondayOffset * 60000))
    const thursdayUTC = new Date(thisThursday.getTime() - (firstMondayOffset * 60000))
    
    // Check if latest submission falls within current week boundaries
    const submissionDate = new Date(latestSubmission.created_at)
    const hasSubmitted = submissionDate >= mondayUTC && submissionDate < thursdayUTC
    
    return { hasSubmitted, error: null, submissionDate: latestSubmission.created_at }
  } catch (error) {
    console.error('Error checking if user submitted this week:', error)
    return { hasSubmitted: false, error }
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
    
    // Handle NEW field names (current database schema)
    if (updates.symptom_tracking_days !== undefined) updateData.symptom_tracking_days = updates.symptom_tracking_days ? parseInt(String(updates.symptom_tracking_days)) : null
    if (updates.detailed_symptom_notes !== undefined) updateData.detailed_symptom_notes = updates.detailed_symptom_notes || null
    if (updates.purposeful_exercise_days !== undefined) updateData.purposeful_exercise_days = updates.purposeful_exercise_days ? parseInt(String(updates.purposeful_exercise_days)) : null
    
    // Handle LEGACY field names (for backward compatibility with old data)
    if (updates.resistance_training_days !== undefined) updateData.resistance_training_days = updates.resistance_training_days ? parseInt(String(updates.resistance_training_days)) : null
    if (updates.focal_heart_rate_training !== undefined) updateData.focal_heart_rate_training = updates.focal_heart_rate_training || null
    if (updates.hunger_days !== undefined) updateData.hunger_days = updates.hunger_days ? parseInt(String(updates.hunger_days)) : null
    
    // Handle other fields
    if (updates.poor_recovery_days !== undefined) updateData.poor_recovery_days = updates.poor_recovery_days ? parseInt(String(updates.poor_recovery_days)) : null
    if (updates.sleep_consistency_score !== undefined) updateData.sleep_consistency_score = updates.sleep_consistency_score ? parseInt(String(updates.sleep_consistency_score)) : null
    if (updates.morning_fat_burn_percent !== undefined) updateData.morning_fat_burn_percent = updates.morning_fat_burn_percent ? parseFloat(String(updates.morning_fat_burn_percent)) : null
    if (updates.body_fat_percentage !== undefined) updateData.body_fat_percentage = updates.body_fat_percentage ? parseFloat(String(updates.body_fat_percentage)) : null
    if (updates.energetic_constraints_reduction_ok !== undefined) updateData.energetic_constraints_reduction_ok = Boolean(updates.energetic_constraints_reduction_ok)
    if (updates.initial_weight !== undefined) updateData.initial_weight = updates.initial_weight ? parseFloat(String(updates.initial_weight)) : null
    if (updates.notes !== undefined) updateData.notes = updates.notes || null
    if (updates.nutrition_compliance_days !== undefined) updateData.nutrition_compliance_days = updates.nutrition_compliance_days ? parseInt(String(updates.nutrition_compliance_days)) : null

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
      
      // Get recent submissions for testing the queue interface
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

// =============================================================================
// COACHING NOTES FUNCTIONS
// =============================================================================

export async function saveCoachingNotes(patientId: string, notes: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        dr_nick_coaching_notes: notes
      })
      .eq('id', patientId)
      .select()

    if (error) {
      console.log('Could not save coaching notes (column may not exist):', error.message)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Error saving coaching notes:', err)
    return { data: null, error: 'Failed to save notes' }
  }
}

export async function getCoachingNotes(patientId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('dr_nick_coaching_notes')
      .eq('id', patientId)
      .single()

    if (error) {
      console.log('Could not get coaching notes (column may not exist):', error.message)
      return { data: { dr_nick_coaching_notes: '' }, error: null } // Return empty notes instead of error
    }

    return { data, error: null }
  } catch (err) {
    console.error('Error getting coaching notes:', err)
    return { data: { dr_nick_coaching_notes: '' }, error: null } // Return empty notes instead of error
  }
}

export async function saveNotesPreferences(preferences: any) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError || !userData?.user) {
      console.log('User not authenticated for saving notes preferences')
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        notes_preferences: preferences
      })
      .eq('id', userData.user.id)
      .select()

    if (error) {
      console.log('Could not save notes preferences (column may not exist):', error.message)
      return { data: null, error: null } // Don't throw, just log
    }

    return { data, error: null }
  } catch (err) {
    console.log('Error saving notes preferences, continuing without saving:', err)
    return { data: null, error: null }
  }
}

export async function getNotesPreferences() {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError || !userData?.user) {
      console.log('User not authenticated for notes preferences')
      return { data: null, error: null } // Return null instead of throwing
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('notes_preferences')
      .eq('id', userData.user.id)
      .single()

    if (error) {
      // If the column doesn't exist or other DB error, return default
      console.log('Notes preferences column may not exist, using defaults')
      return { data: null, error: null }
    }

    return { data, error: null }
  } catch (err) {
    console.log('Error getting notes preferences, using defaults:', err)
    return { data: null, error: null } // Return defaults instead of throwing
  }
}

export function countNotesEntries(notes: string): number {
  if (!notes || notes.trim() === '') return 0
  
  // Count lines that have substantial content (more than just whitespace)
  const lines = notes.split('\n').filter(line => line.trim().length > 0)
  return lines.length
}