// src/app/components/health/adminService.ts
// Admin service for Dr. Nick to manage patient accounts

import { supabase } from '../auth/AuthContext'

export interface WeekZeroData {
  weight: string
  waist: string
  initial_notes?: string
}

export interface PatientCreationData {
  email: string
  password: string
  fullName: string
  weekZeroData: WeekZeroData
  weightChangeGoalPercent?: number
}

// Check if email is already taken
export async function validateEmailAvailability(email: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (error && error.code === 'PGRST116') {
      // No rows returned - email is available
      return { available: true, error: null }
    }

    if (data) {
      return { available: false, error: 'Email already exists' }
    }

    return { available: true, error: null }
  } catch (err) {
    return { available: false, error: 'Error checking email availability' }
  }
}

// Create a new patient account with Week 0 baseline
export async function createPatientAccount(patientData: PatientCreationData) {
  try {
    // Step 1: Check email availability
    const emailCheck = await validateEmailAvailability(patientData.email)
    if (!emailCheck.available) {
      return { success: false, error: emailCheck.error }
    }

    // Step 2: Create auth user with regular signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: patientData.email.toLowerCase(),
      password: patientData.password,
      options: {
        data: {
          full_name: patientData.fullName
        }
      }
    })

    if (authError) {
      return { success: false, error: `Failed to create account: ${authError.message}` }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user account' }
    }

    const userId = authData.user.id

    // Step 3: Create profile with password reference and weight goal
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: patientData.email.toLowerCase(),
        full_name: patientData.fullName,
        patient_password: patientData.password, // Store for Dr. Nick's reference
        weight_change_goal_percent: patientData.weightChangeGoalPercent || 1.0
      })

    if (profileError) {
      return { success: false, error: `Failed to create profile: ${profileError.message}` }
    }

    // Step 4: Create Week 0 baseline data
    const weekZeroError = await setupWeekZeroBaseline(userId, patientData.weekZeroData)
    if (weekZeroError) {
      return { success: false, error: `Failed to setup Week 0 baseline: ${weekZeroError}` }
    }

    return { 
      success: true, 
      error: null,
      patientId: userId,
      credentials: {
        email: patientData.email,
        password: patientData.password
      }
    }

  } catch (err) {
    return { success: false, error: `Unexpected error: ${err}` }
  }
}

// Setup Week 0 baseline data for a patient
export async function setupWeekZeroBaseline(userId: string, weekZeroData: WeekZeroData) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('health_data')
      .insert({
        user_id: userId,
        date: today,
        week_number: 0, // Week 0 = baseline
        weight: parseFloat(weekZeroData.weight) || null,
        waist: parseFloat(weekZeroData.waist) || null,
        data_entered_by: 'dr_nick',
        needs_review: false, // Dr. Nick's admin entries don't need review
        // Set initial_weight for reference
        initial_weight: parseFloat(weekZeroData.weight) || null
      })

    if (error) {
      return error.message
    }

    return null // Success
  } catch (err) {
    return `Error setting up baseline: ${err}`
  }
}

// Get all patients for Dr. Nick's dashboard
export async function getAllPatients() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        created_at,
        patient_password
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return { patients: [], error: error.message }
    }

    return { patients: data || [], error: null }
  } catch (err) {
    return { patients: [], error: `Error fetching patients: ${err}` }
  }
}

// Get Week 0 baseline for a specific patient
export async function getPatientWeekZero(patientId: string) {
  try {
    const { data, error } = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', patientId)
      .eq('week_number', 0)
      .single()

    if (error && error.code === 'PGRST116') {
      return { weekZero: null, error: null } // No Week 0 data found
    }

    if (error) {
      return { weekZero: null, error: error.message }
    }

    return { weekZero: data, error: null }
  } catch (err) {
    return { weekZero: null, error: `Error fetching Week 0 data: ${err}` }
  }
}

// Update patient's weight change goal
export async function updatePatientWeightGoal(userId: string, goalPercent: number) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ weight_change_goal_percent: goalPercent })
      .eq('id', userId)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: `Error updating goal: ${err}` }
  }
} 