// src/app/components/health/healthService.ts
// Enhanced service for week-based tracking with charts support

import { supabase } from '../auth/AuthContext'
import { centimetersToInches, kilogramsToPounds } from './unitCore'

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
  visceral_fat_level?: number | null
  subcutaneous_fat_level?: number | null
  belly_fat_percent?: number | null
  resting_heart_rate?: number | null
  total_muscle_mass_percent?: number | null
  nutrition_compliance_days?: number | null
  systolic_bp?: number | null
  diastolic_bp?: number | null
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
  systolic_bp?: string
  diastolic_bp?: string
  visceral_fat_level?: string
  subcutaneous_fat_level?: string
  belly_fat_percent?: string
  resting_heart_rate?: string
  total_muscle_mass_percent?: string
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

    // Determine user's unit system to convert inputs to canonical Imperial before saving
    let unitSystem: 'imperial' | 'metric' = 'imperial'
    try {
      const { data: unitRow } = await supabase
        .from('profiles')
        .select('unit_system')
        .eq('id', user.id)
        .single()
      if (unitRow?.unit_system === 'metric') unitSystem = 'metric'
    } catch {}

    const toTwo = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)
    const weightLbs = data.weight ? (unitSystem === 'metric' ? kilogramsToPounds(parseFloat(data.weight)) : parseFloat(data.weight)) : null
    const waistInches = data.waist ? (unitSystem === 'metric' ? centimetersToInches(parseFloat(data.waist)) : parseFloat(data.waist)) : null

    // Convert string inputs to appropriate types
    const checkinData: any = {
      user_id: user.id,
      date: data.date,
      week_number: parseInt(data.week_number),
      weight: toTwo(weightLbs),
      waist: toTwo(waistInches),
      systolic_bp: data.systolic_bp ? Math.round(parseFloat(data.systolic_bp)) : null,
      diastolic_bp: data.diastolic_bp ? Math.round(parseFloat(data.diastolic_bp)) : null,
      visceral_fat_level: data.visceral_fat_level !== undefined && data.visceral_fat_level !== null && data.visceral_fat_level !== '' ? parseFloat(String(data.visceral_fat_level)) : null,
      subcutaneous_fat_level: data.subcutaneous_fat_level !== undefined && data.subcutaneous_fat_level !== null && data.subcutaneous_fat_level !== '' ? parseFloat(String(data.subcutaneous_fat_level)) : null,
      belly_fat_percent: data.belly_fat_percent !== undefined && data.belly_fat_percent !== null && data.belly_fat_percent !== '' ? parseFloat(String(data.belly_fat_percent)) : null,
      resting_heart_rate: data.resting_heart_rate !== undefined && data.resting_heart_rate !== null && data.resting_heart_rate !== '' ? parseInt(String(data.resting_heart_rate)) : null,
      total_muscle_mass_percent: data.total_muscle_mass_percent !== undefined && data.total_muscle_mass_percent !== null && data.total_muscle_mass_percent !== '' ? parseFloat(String(data.total_muscle_mass_percent)) : null,
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
      // Do not overwrite existing patient row per policy; return an error-like response
      return { data: null, error: { message: `Patient row for week already exists` } as any }
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

    // Fetch patient's unit system to convert to canonical Imperial
    let unitSystem: 'imperial' | 'metric' = 'imperial'
    try {
      const { data: unitRow } = await supabase
        .from('profiles')
        .select('unit_system')
        .eq('id', patientUserId)
        .single()
      if (unitRow?.unit_system === 'metric') unitSystem = 'metric'
    } catch {}

    const toTwo = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)
    const initialWeightLbs = data.initial_weight ? (unitSystem === 'metric' ? kilogramsToPounds(parseFloat(data.initial_weight)) : parseFloat(data.initial_weight)) : null

    const setupData: Partial<WeeklyCheckin> = {
      user_id: patientUserId,
      date: data.date,
      week_number: 0,
      initial_weight: toTwo(initialWeightLbs)!,
      weight: toTwo(initialWeightLbs)!,
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
  if (updates.visceral_fat_level !== undefined) updateData.visceral_fat_level = updates.visceral_fat_level !== null && updates.visceral_fat_level !== ('' as any) ? parseFloat(String(updates.visceral_fat_level)) : null
  if (updates.subcutaneous_fat_level !== undefined) updateData.subcutaneous_fat_level = updates.subcutaneous_fat_level !== null && updates.subcutaneous_fat_level !== ('' as any) ? parseFloat(String(updates.subcutaneous_fat_level)) : null
  if (updates.belly_fat_percent !== undefined) updateData.belly_fat_percent = updates.belly_fat_percent !== null && updates.belly_fat_percent !== ('' as any) ? parseFloat(String(updates.belly_fat_percent)) : null
  if (updates.resting_heart_rate !== undefined) updateData.resting_heart_rate = updates.resting_heart_rate !== null && updates.resting_heart_rate !== ('' as any) ? parseInt(String(updates.resting_heart_rate)) : null
  if (updates.total_muscle_mass_percent !== undefined) updateData.total_muscle_mass_percent = updates.total_muscle_mass_percent !== null && updates.total_muscle_mass_percent !== ('' as any) ? parseFloat(String(updates.total_muscle_mass_percent)) : null
    if (updates.systolic_bp !== undefined) updateData.systolic_bp = updates.systolic_bp ? parseInt(String(updates.systolic_bp)) : null
    if (updates.diastolic_bp !== undefined) updateData.diastolic_bp = updates.diastolic_bp ? parseInt(String(updates.diastolic_bp)) : null
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

// Function to create a new health record for a specific patient (Dr. Nick add-week modal)
export async function createHealthRecordForPatient(
  patientUserId: string,
  values: Partial<WeeklyCheckin>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    if (!patientUserId) {
      return { data: null, error: { message: 'Patient ID is required' } }
    }

    // Re-validate: prevent duplicate week numbers
    if (typeof values.week_number !== 'number' || values.week_number < 1 || values.week_number > 100) {
      return { data: null, error: { message: 'Week number must be between 1 and 100' } }
    }

    const { data: existing } = await supabase
      .from('health_data')
      .select('id')
      .eq('user_id', patientUserId)
      .eq('week_number', values.week_number)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { data: null, error: { message: `Week ${values.week_number} already exists for this patient` } }
    }

    // Fetch patient's unit system to convert to canonical Imperial before saving
    let unitSystem: 'imperial' | 'metric' = 'imperial'
    try {
      const { data: unitRow } = await supabase
        .from('profiles')
        .select('unit_system')
        .eq('id', patientUserId)
        .single()
      if ((unitRow as any)?.unit_system === 'metric') unitSystem = 'metric'
    } catch {}

    const toTwo = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)

    // Convert weight/waist from patient's unit system to imperial for storage
    const weightLbs = values.weight !== undefined && values.weight !== null && values.weight !== ('' as any)
      ? (unitSystem === 'metric' ? kilogramsToPounds(parseFloat(String(values.weight))) : parseFloat(String(values.weight)))
      : null
    const waistInches = values.waist !== undefined && values.waist !== null && values.waist !== ('' as any)
      ? (unitSystem === 'metric' ? centimetersToInches(parseFloat(String(values.waist))) : parseFloat(String(values.waist)))
      : null

    const insertData: any = {
      user_id: patientUserId,
      week_number: values.week_number,
      // Date is optional per spec
      date: values.date || null,
      weight: toTwo(weightLbs),
      waist: toTwo(waistInches),
      // Optional numeric fields with parsing
      resistance_training_days: values.resistance_training_days !== undefined && values.resistance_training_days !== null && values.resistance_training_days !== ('' as any)
        ? parseInt(String(values.resistance_training_days)) : null,
      symptom_tracking_days: values.symptom_tracking_days !== undefined && values.symptom_tracking_days !== null && values.symptom_tracking_days !== ('' as any)
        ? parseInt(String(values.symptom_tracking_days)) : null,
      detailed_symptom_notes: values.detailed_symptom_notes || null,
      purposeful_exercise_days: values.purposeful_exercise_days !== undefined && values.purposeful_exercise_days !== null && values.purposeful_exercise_days !== ('' as any)
        ? parseInt(String(values.purposeful_exercise_days)) : null,
      poor_recovery_days: values.poor_recovery_days !== undefined && values.poor_recovery_days !== null && values.poor_recovery_days !== ('' as any)
        ? parseInt(String(values.poor_recovery_days)) : null,
      sleep_consistency_score: values.sleep_consistency_score !== undefined && values.sleep_consistency_score !== null && values.sleep_consistency_score !== ('' as any)
        ? parseInt(String(values.sleep_consistency_score)) : null,
      morning_fat_burn_percent: values.morning_fat_burn_percent !== undefined && values.morning_fat_burn_percent !== null && values.morning_fat_burn_percent !== ('' as any)
        ? parseFloat(String(values.morning_fat_burn_percent)) : null,
      body_fat_percentage: values.body_fat_percentage !== undefined && values.body_fat_percentage !== null && values.body_fat_percentage !== ('' as any)
        ? parseFloat(String(values.body_fat_percentage)) : null,
    visceral_fat_level: values.visceral_fat_level !== undefined && values.visceral_fat_level !== null && values.visceral_fat_level !== ('' as any)
      ? parseFloat(String(values.visceral_fat_level)) : null,
    subcutaneous_fat_level: values.subcutaneous_fat_level !== undefined && values.subcutaneous_fat_level !== null && values.subcutaneous_fat_level !== ('' as any)
      ? parseFloat(String(values.subcutaneous_fat_level)) : null,
    belly_fat_percent: values.belly_fat_percent !== undefined && values.belly_fat_percent !== null && values.belly_fat_percent !== ('' as any)
      ? parseFloat(String(values.belly_fat_percent)) : null,
    resting_heart_rate: values.resting_heart_rate !== undefined && values.resting_heart_rate !== null && values.resting_heart_rate !== ('' as any)
      ? parseInt(String(values.resting_heart_rate)) : null,
    total_muscle_mass_percent: values.total_muscle_mass_percent !== undefined && values.total_muscle_mass_percent !== null && values.total_muscle_mass_percent !== ('' as any)
      ? parseFloat(String(values.total_muscle_mass_percent)) : null,
      nutrition_compliance_days: values.nutrition_compliance_days !== undefined && values.nutrition_compliance_days !== null && values.nutrition_compliance_days !== ('' as any)
        ? parseInt(String(values.nutrition_compliance_days)) : null,
      systolic_bp: values.systolic_bp !== undefined && values.systolic_bp !== null && values.systolic_bp !== ('' as any)
        ? parseInt(String(values.systolic_bp)) : null,
      diastolic_bp: values.diastolic_bp !== undefined && values.diastolic_bp !== null && values.diastolic_bp !== ('' as any)
        ? parseInt(String(values.diastolic_bp)) : null,
      notes: values.notes || null,
      // Metadata per spec
      data_entered_by: 'dr_nick',
      needs_review: true,
    }

    const result = await supabase
      .from('health_data')
      .insert(insertData)
      .select()

    return result
  } catch (error) {
    console.error('Error creating health record for patient:', error)
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

// Get historical submission data for a specific patient and week (for historical review)
export async function getHistoricalSubmissionDetails(patientId: string, weekNumber: number) {
  try {
    // Use the exact same pattern as getSubmissionsNeedingReview for consistency
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
      .eq('user_id', patientId)
      .eq('week_number', weekNumber)
      .single()

    if (result.error || !result.data) {
      console.error('Error fetching historical submission:', result.error)
      return { data: null, error: result.error }
    }

    // Transform the data to match the expected format (same as current review queue)
    const transformedData = {
      ...result.data,
      profiles: {
        id: result.data.profiles?.id || patientId,
        email: result.data.profiles?.email || 'unknown@email.com',
        first_name: result.data.profiles?.full_name?.split(' ')[0] || 'Patient',
        last_name: result.data.profiles?.full_name?.split(' ').slice(1).join(' ') || ''
      }
    }

    return { data: transformedData, error: null }
  } catch (error) {
    console.error('Error fetching historical submission details:', error)
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