// src/app/components/health/HealthForm.tsx
// Weekly health check-in form with smart week detection and developer mode

'use client'

import { useState, useEffect } from 'react'
import { saveWeeklyCheckin, getCheckinForWeek, type CheckinFormData } from './healthService'
import { supabase } from '../auth/AuthContext'

// Extended CheckinFormData interface to include missing fields
interface ExtendedCheckinFormData extends CheckinFormData {
  notes?: string
}

// Smart week calculation based on existing submissions and grace period
const calculateCurrentWeek = async (userId: string): Promise<number> => {
  try {
    // Get all existing submissions for this user
    const { data: submissions } = await supabase
      .from('health_data')
      .select('week_number, date, created_at')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(5) // Get last 5 submissions to analyze pattern

    if (!submissions || submissions.length === 0) {
      return 1 // First submission = Week 1
    }

    // Find the highest week number submitted
    const highestWeek = Math.max(...submissions.map(s => s.week_number || 0))
    
    // Get the most recent submission
    const mostRecentSubmission = submissions.reduce((latest, current) => {
      const latestDate = new Date(latest.created_at || latest.date)
      const currentDate = new Date(current.created_at || current.date)
      return currentDate > latestDate ? current : latest
    })

    // Calculate days since most recent submission
    const mostRecentDate = new Date(mostRecentSubmission.created_at || mostRecentSubmission.date)
    const today = new Date()
    const daysSinceLastSubmission = Math.floor((today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24))

    // Smart logic:
    // - If last submission was within 3 days, allow resubmission to same week
    // - If 4-10 days ago, move to next week
    // - If more than 10 days, calculate weeks passed
    
    if (daysSinceLastSubmission <= 3) {
      // Within grace period - can still submit to current week
      return mostRecentSubmission.week_number || 1
    } else if (daysSinceLastSubmission <= 10) {
      // Move to next week
      return (mostRecentSubmission.week_number || 0) + 1
    } else {
      // Calculate weeks passed (assuming weekly submissions)
      const weeksPassedSinceLastSubmission = Math.floor(daysSinceLastSubmission / 7)
      return Math.min((mostRecentSubmission.week_number || 0) + weeksPassedSinceLastSubmission, 20) // Cap at week 20
    }
  } catch (error) {
    console.error('Error calculating current week:', error)
    return 1 // Default to Week 1 on error
  }
}

export default function HealthForm() {
  // Get user data
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Developer mode state
  const [devMode, setDevMode] = useState(false)
  const [devWeek, setDevWeek] = useState(1)
  
  // Smart week calculation
  const [smartWeek, setSmartWeek] = useState(1)
  const activeWeek = devMode ? devWeek : smartWeek
  
  // Form state with extended interface (date will be set automatically on submission)
  const [formData, setFormData] = useState<ExtendedCheckinFormData>({
    date: '', // Not used in UI, will be set automatically on submission
    week_number: activeWeek.toString(),
    weight: '',
    waist: '',
    resistance_training_days: '',
    focal_heart_rate_training: '',
    hunger_days: '',
    poor_recovery_days: '',
    notes: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})

  // Load user data and calculate smart week
  useEffect(() => {
    loadUserAndCalculateWeek()
  }, [])

  // Recalculate when activeWeek changes
  useEffect(() => {
    loadExistingFormData()
  }, [activeWeek])

  const loadUserAndCalculateWeek = async () => {
    try {
      setIsLoading(true)
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      setUser(authUser)
      
      // Calculate smart week based on submission history
      const calculatedWeek = await calculateCurrentWeek(authUser.id)
      setSmartWeek(calculatedWeek)
      
    } catch (error) {
      console.error('Error loading user data:', error)
      setMessage('Error loading form data')
    } finally {
      setIsLoading(false)
      setLoading(false)
    }
  }

  const loadExistingFormData = async () => {
    if (!user) return
    
    try {
      // Load existing form data for this week
      const result = await getCheckinForWeek(activeWeek)
      if (result.data && result.data.length > 0) {
        const existingData = result.data[0]
        setFormData({
          date: '', // Not used in UI, will be set automatically on submission
          week_number: activeWeek.toString(),
          weight: existingData.weight?.toString() || '',
          waist: existingData.waist?.toString() || '',
          resistance_training_days: existingData.resistance_training_days?.toString() || '',
          focal_heart_rate_training: existingData.focal_heart_rate_training || '',
          hunger_days: existingData.hunger_days?.toString() || '',
          poor_recovery_days: existingData.poor_recovery_days?.toString() || '',
          notes: '' // Will be added to database later if needed
        })
      } else {
        // Reset form for new week
        setFormData({
          date: '', // Not used in UI, will be set automatically on submission
          week_number: activeWeek.toString(),
          weight: '',
          waist: '',
          resistance_training_days: '',
          focal_heart_rate_training: '',
          hunger_days: '',
          poor_recovery_days: '',
          notes: ''
        })
      }
    } catch (error) {
      console.error('Error loading form data:', error)
    }
  }

  // Validation function
  const validateForm = () => {
    const errors: {[key: string]: string} = {}
    
    // Weight validation
    if (formData.weight && (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0)) {
      errors.weight = 'Weight must be a valid number (e.g., 165.5)'
    }
    
    // Waist validation
    if (formData.waist && (isNaN(Number(formData.waist)) || Number(formData.waist) <= 0)) {
      errors.waist = 'Waist circumference must be a valid number (e.g., 32.5)'
    }
    
    // Resistance training days validation
    if (formData.resistance_training_days && (isNaN(Number(formData.resistance_training_days)) || 
        Number(formData.resistance_training_days) < 0 || Number(formData.resistance_training_days) > 7)) {
      errors.resistance_training_days = 'Resistance training days must be a number between 0-7 (e.g., 3)'
    }
    
    // Focal heart rate training validation (must be a number representing minutes)
    if (formData.focal_heart_rate_training && (isNaN(Number(formData.focal_heart_rate_training)) || 
        Number(formData.focal_heart_rate_training) < 0)) {
      errors.focal_heart_rate_training = 'Focal heart rate training must be a number of minutes (e.g., 45)'
    }
    
    // Hunger days validation
    if (formData.hunger_days && (isNaN(Number(formData.hunger_days)) || 
        Number(formData.hunger_days) < 0 || Number(formData.hunger_days) > 7)) {
      errors.hunger_days = 'Hunger days must be a number between 0-7 (e.g., 2)'
    }
    
    // Poor recovery days validation
    if (formData.poor_recovery_days && (isNaN(Number(formData.poor_recovery_days)) || 
        Number(formData.poor_recovery_days) < 0 || Number(formData.poor_recovery_days) > 7)) {
      errors.poor_recovery_days = 'Poor recovery days must be a number between 0-7 (e.g., 1)'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setValidationErrors({})

    // Validate form
    if (!validateForm()) {
      setIsSubmitting(false)
      setMessage('Please fix the errors below and try again.')
      return
    }

    try {
      // Always use current date for submission
      const submissionDate = new Date().toISOString().split('T')[0]
      
      // Convert to the base CheckinFormData format for saving
      const checkinData: CheckinFormData = {
        date: submissionDate,
        week_number: activeWeek.toString(),
        weight: formData.weight,
        waist: formData.waist,
        resistance_training_days: formData.resistance_training_days,
        focal_heart_rate_training: formData.focal_heart_rate_training,
        hunger_days: formData.hunger_days,
        poor_recovery_days: formData.poor_recovery_days
      }

      const result = await saveWeeklyCheckin(checkinData)

      if (result.error) {
        setMessage(`Error: ${(result.error as any)?.message || 'Unknown error'}`)
      } else {
        setMessage('✅ Weekly check-in saved successfully!')
        // Recalculate smart week after successful submission
        if (!devMode && user) {
          const newSmartWeek = await calculateCurrentWeek(user.id)
          setSmartWeek(newSmartWeek)
        }
      }
    } catch (error) {
      setMessage('Error submitting form. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof ExtendedCheckinFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Update active week when dev mode changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      week_number: activeWeek.toString()
    }))
  }, [activeWeek])

  if (loading || isLoading) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="text-gray-600">Loading form...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      
      {/* Developer Mode Toggle - Simple Button */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">🛠️ Developer Mode</h3>
            <p className="text-sm text-gray-600">
              {devMode ? "Manual week selection enabled" : "Smart week calculation active"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDevMode(!devMode)}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              devMode 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            {devMode ? '✅ Dev Mode ON' : '⚪ Dev Mode OFF'}
          </button>
        </div>
        
        {/* Week Selection in Dev Mode */}
        {devMode && (
          <div className="mt-4 p-3 bg-yellow-100 rounded">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Week for Testing:
            </label>
            <select
              value={devWeek}
              onChange={(e) => setDevWeek(Number(e.target.value))}
              className="p-2 border border-gray-300 rounded text-gray-900"
            >
              {[...Array(20)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Week {i + 1}
                </option>
              ))}
            </select>
            <p className="text-sm text-yellow-700 mt-2">
              ⚠️ Testing mode - You can submit forms for any week
            </p>
          </div>
        )}
        
        {/* Current Week Display */}
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <p className="text-sm">
            <strong>Current Week:</strong> {activeWeek}
          </p>
          {!devMode && (
            <p className="text-xs text-gray-500 mt-1">
              💡 Smart calculation based on your submission history with 3-day grace period
            </p>
          )}
        </div>
      </div>

      {/* Form Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          📋 Week {activeWeek} Check-in
        </h2>
        <p className="text-gray-600">
          Your weekly progress update - all measurements should be numbers only
        </p>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('Error') || message.includes('fix the errors')
            ? 'bg-red-100 text-red-700 border border-red-300' 
            : 'bg-green-100 text-green-700 border border-green-300'
        }`}>
          {message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Body Measurements */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">📊 Body Measurements</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                Weight (lbs) - Numbers Only
              </label>
              <input
                type="number"
                id="weight"
                step="0.1"
                min="0"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.weight ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="165.5"
              />
              {validationErrors.weight && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.weight}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="waist" className="block text-sm font-medium text-gray-700 mb-1">
                Waist Circumference (inches) - Numbers Only
              </label>
              <input
                type="number"
                id="waist"
                step="0.1"
                min="0"
                value={formData.waist}
                onChange={(e) => handleInputChange('waist', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.waist ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="32.5"
              />
              {validationErrors.waist && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.waist}</p>
              )}
            </div>
          </div>
        </div>

        {/* Exercise & Training */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">💪 Exercise & Training</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="resistance_training_days" className="block text-sm font-medium text-gray-700 mb-1">
                Resistance Training Days (0-7) - Numbers Only
              </label>
              <input
                type="number"
                id="resistance_training_days"
                min="0"
                max="7"
                value={formData.resistance_training_days}
                onChange={(e) => handleInputChange('resistance_training_days', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.resistance_training_days ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="3"
              />
              {validationErrors.resistance_training_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.resistance_training_days}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="focal_heart_rate_training" className="block text-sm font-medium text-gray-700 mb-1">
                Focal Heart Rate Training (minutes) - Numbers Only
              </label>
              <input
                type="number"
                id="focal_heart_rate_training"
                min="0"
                value={formData.focal_heart_rate_training}
                onChange={(e) => handleInputChange('focal_heart_rate_training', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.focal_heart_rate_training ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="45"
              />
              {validationErrors.focal_heart_rate_training && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.focal_heart_rate_training}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Total minutes of heart rate training this week
              </p>
            </div>
          </div>
        </div>

        {/* Recovery & Nutrition */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">😴 Recovery & Nutrition</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="hunger_days" className="block text-sm font-medium text-gray-700 mb-1">
                Days with Excessive Hunger (0-7) - Numbers Only
              </label>
              <input
                type="number"
                id="hunger_days"
                min="0"
                max="7"
                value={formData.hunger_days}
                onChange={(e) => handleInputChange('hunger_days', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.hunger_days ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="2"
              />
              {validationErrors.hunger_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.hunger_days}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="poor_recovery_days" className="block text-sm font-medium text-gray-700 mb-1">
                Days with Poor Recovery (0-7) - Numbers Only
              </label>
              <input
                type="number"
                id="poor_recovery_days"
                min="0"
                max="7"
                value={formData.poor_recovery_days}
                onChange={(e) => handleInputChange('poor_recovery_days', e.target.value)}
                className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  validationErrors.poor_recovery_days ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {validationErrors.poor_recovery_days && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.poor_recovery_days}</p>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">📝 Notes</h3>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Any additional observations, challenges, or questions for Dr. Nick..."
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 font-medium"
          >
            {isSubmitting ? 'Submitting...' : `Submit Week ${activeWeek} Check-in`}
          </button>
        </div>
      </form>
    </div>
  )
}