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
    const checkinData: Partial<WeeklyCheckin> = {
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