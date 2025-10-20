// src/app/components/health/adminService.ts
// Admin service for Dr. Nick to manage patient accounts

import { supabase } from '../auth/AuthContext'
import { UnitSystem, centimetersToInches, kilogramsToPounds } from './unitCore'

export interface WeekZeroData {
  weight: string
  waist: string
  height: string
}

export interface PatientCreationData {
  email: string
  password: string
  fullName: string
  weekZeroData: WeekZeroData
  weightChangeGoalPercent?: number
  proteinGoalGrams?: number
  resistanceTrainingGoal?: number
  drNickCoachingNotes?: string
  clientStatus?: string
  unitSystem?: UnitSystem
  trackBloodPressure?: boolean
  trackBodyComposition?: boolean
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
    // Call the API route to create the patient server-side
    const response = await fetch('/api/admin/create-patient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to create patient' }
    }

    return {
      success: true,
      error: null,
      patientId: result.patientId,
      credentials: result.credentials
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
        client_status,
        height,
        weight_change_goal_percent,
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