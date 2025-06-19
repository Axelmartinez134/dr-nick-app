// src/app/components/health/HealthForm.tsx
// Updated weekly check-in form with week-based tracking

'use client'

import { useState, useEffect } from 'react'
import { saveWeeklyCheckin, getCheckinForWeek, type CheckinFormData } from './healthService'

export default function HealthForm() {
  // Form state
  const [formData, setFormData] = useState<CheckinFormData>({
    date: '', // Will be set after mount to avoid SSR mismatch
    week_number: '1', // Default to Week 1
    weight: '',
    waist: '',
    resistance_training_days: '',
    focal_heart_rate_training: '',
    hunger_days: '',
    poor_recovery_days: '',
  })
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isUpdate, setIsUpdate] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Set mounted and default date after component mounts (client-side only)
  useEffect(() => {
    setMounted(true)
    setFormData(prev => ({
      ...prev,
      date: new Date().toISOString().split('T')[0] // Set date after mount
    }))
  }, [])

  // Load existing data when week number changes (only after mount)
  useEffect(() => {
    if (mounted && formData.week_number) {
      loadExistingData()
    }
  }, [formData.week_number, mounted])

  // Function to load existing data for selected week
  const loadExistingData = async () => {
    if (!formData.week_number) return

    const weekNumber = parseInt(formData.week_number)
    const { data, error } = await getCheckinForWeek(weekNumber)
    
    if (data && !error) {
      // Found existing data - populate form
      setFormData({
        date: data.date,
        week_number: formData.week_number,
        weight: data.weight?.toString() || '',
        waist: data.waist?.toString() || '',
        resistance_training_days: data.resistance_training_days?.toString() || '',
        focal_heart_rate_training: data.focal_heart_rate_training || '',
        hunger_days: data.hunger_days?.toString() || '',
        poor_recovery_days: data.poor_recovery_days?.toString() || '',
      })
      setIsUpdate(true)
    } else {
      // No existing data - clear form (except week number and date)
      setFormData({
        date: formData.date,
        week_number: formData.week_number,
        weight: '',
        waist: '',
        resistance_training_days: '',
        focal_heart_rate_training: '',
        hunger_days: '',
        poor_recovery_days: '',
      })
      setIsUpdate(false)
    }
  }

  // Handle input changes
  const handleInputChange = (field: keyof CheckinFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle form submission
  const handleSubmit = async () => {
    setLoading(true)
    setMessage('')

    // Validation
    if (!formData.date) {
      setMessage('Please select a date')
      setLoading(false)
      return
    }

    if (!formData.week_number) {
      setMessage('Please select a week number')
      setLoading(false)
      return
    }

    // Check if at least one field is provided
    if (!formData.weight && !formData.waist && !formData.resistance_training_days && 
        !formData.focal_heart_rate_training && !formData.hunger_days && !formData.poor_recovery_days) {
      setMessage('Please fill out at least one field')
      setLoading(false)
      return
    }

    // Validate number inputs
    if (formData.weight && (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0)) {
      setMessage('Please enter a valid weight')
      setLoading(false)
      return
    }

    if (formData.waist && (isNaN(Number(formData.waist)) || Number(formData.waist) <= 0)) {
      setMessage('Please enter a valid waist measurement')
      setLoading(false)
      return
    }

    if (formData.resistance_training_days && (isNaN(Number(formData.resistance_training_days)) || 
        Number(formData.resistance_training_days) < 0 || Number(formData.resistance_training_days) > 5)) {
      setMessage('Resistance training days must be between 0 and 5')
      setLoading(false)
      return
    }

    if (formData.hunger_days && (isNaN(Number(formData.hunger_days)) || 
        Number(formData.hunger_days) < 0 || Number(formData.hunger_days) > 7)) {
      setMessage('Hunger days must be between 0 and 7')
      setLoading(false)
      return
    }

    if (formData.poor_recovery_days && (isNaN(Number(formData.poor_recovery_days)) || 
        Number(formData.poor_recovery_days) < 0 || Number(formData.poor_recovery_days) > 7)) {
      setMessage('Poor recovery days must be between 0 and 7')
      setLoading(false)
      return
    }

    // Validate week number
    const weekNum = parseInt(formData.week_number)
    if (weekNum < 1 || weekNum > 30) {
      setMessage('Week number must be between 1 and 30')
      setLoading(false)
      return
    }

    // Save to database
    const { data, error } = await saveWeeklyCheckin(formData)

    if (error) {
      setMessage((error as Error).message || 'Failed to save weekly check-in') 
    } else {
      setMessage(`Week ${formData.week_number} check-in ${isUpdate ? 'updated' : 'saved'} successfully!`)
      // Check if this becomes an update after saving
      if (!isUpdate) {
        setIsUpdate(true)
      }
    }

    setLoading(false)
  }

  // Quick week selection helpers
  const setWeekNumber = (week: number) => {
    handleInputChange('week_number', week.toString())
  }

  // Don't render until mounted to avoid SSR mismatch
  if (!mounted) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading form...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            📋 Weekly Check-in for Dr. Nick
          </h2>
          <p className="text-gray-600">
            Complete your weekly progress report using the program week number
          </p>
        </div>

        {/* Display messages */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.includes('successfully') 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Form Container */}
        <div className="space-y-6">
          
          {/* Week Number and Date Section */}
          <div className="bg-blue-50 p-4 rounded-lg">
            
            {/* Week Number Selection */}
            <div className="mb-4">
              <label htmlFor="week_number" className="block text-sm font-medium text-gray-700 mb-2">
                Program Week Number
              </label>
              
              {/* Quick week buttons */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(week => (
                  <button
                    key={week}
                    type="button"
                    onClick={() => setWeekNumber(week)}
                    className={`px-3 py-1 text-sm rounded ${
                      formData.week_number === week.toString()
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    Week {week}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-3 flex-wrap">
                {[9, 10, 11, 12, 13, 14, 15, 16].map(week => (
                  <button
                    key={week}
                    type="button"
                    onClick={() => setWeekNumber(week)}
                    className={`px-3 py-1 text-sm rounded ${
                      formData.week_number === week.toString()
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    Week {week}
                  </button>
                ))}
              </div>

              {/* Manual week input */}
              <input
                id="week_number"
                type="number"
                min="1"
                max="30"
                value={formData.week_number}
                onChange={(e) => handleInputChange('week_number', e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Week #"
                disabled={loading}
              />
              
              <p className="text-xs text-gray-500 mt-1">
                Week 0 = Initial assessment (Dr. Nick only) | Weeks 1-16+ = Patient progress
              </p>
            </div>

            {/* Date Input */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Check-in Date
              </label>
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            
            {isUpdate && (
              <p className="text-sm text-orange-600 mt-2">
                ⚠️ Updating existing check-in for Week {formData.week_number}
              </p>
            )}
          </div>

          {/* Body Measurements */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📏 Body Measurements</h3>
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Weight */}
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (lbs)
                </label>
                <input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="185.5"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Measured with home scale (same time each week)
                </p>
              </div>

              {/* Waist */}
              <div>
                <label htmlFor="waist" className="block text-sm font-medium text-gray-700 mb-1">
                  Waist (inches)
                </label>
                <input
                  id="waist"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.waist}
                  onChange={(e) => handleInputChange('waist', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="34.0"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Measured at belly button level with stomach 100% relaxed
                </p>
              </div>

            </div>
          </div>

          {/* Exercise & Training */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">💪 Exercise & Training</h3>
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Resistance Training */}
              <div>
                <label htmlFor="resistance_training_days" className="block text-sm font-medium text-gray-700 mb-1">
                  Resistance Training Days
                </label>
                <select
                  id="resistance_training_days"
                  value={formData.resistance_training_days}
                  onChange={(e) => handleInputChange('resistance_training_days', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                >
                  <option value="">Select days completed</option>
                  <option value="0">0 out of 5 days</option>
                  <option value="1">1 out of 5 days</option>
                  <option value="2">2 out of 5 days</option>
                  <option value="3">3 out of 5 days</option>
                  <option value="4">4 out of 5 days</option>
                  <option value="5">5 out of 5 days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Out of planned 5 days for this week
                </p>
              </div>

              {/* Focal Heart Rate Training */}
              <div>
                <label htmlFor="focal_heart_rate_training" className="block text-sm font-medium text-gray-700 mb-1">
                  Focal Heart Rate Training
                </label>
                <input
                  id="focal_heart_rate_training"
                  type="text"
                  value={formData.focal_heart_rate_training}
                  onChange={(e) => handleInputChange('focal_heart_rate_training', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., 3 out of 4 sessions"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Amount completed out of total prescribed weekly amount
                </p>
              </div>

            </div>
          </div>

          {/* Recovery & Nutrition */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🍽️ Recovery & Nutrition</h3>
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Hunger Days */}
              <div>
                <label htmlFor="hunger_days" className="block text-sm font-medium text-gray-700 mb-1">
                  Days of Hunger This Week
                </label>
                <select
                  id="hunger_days"
                  value={formData.hunger_days}
                  onChange={(e) => handleInputChange('hunger_days', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                >
                  <option value="">Select number of days</option>
                  <option value="0">0 days</option>
                  <option value="1">1 day</option>
                  <option value="2">2 days</option>
                  <option value="3">3 days</option>
                  <option value="4">4 days</option>
                  <option value="5">5 days</option>
                  <option value="6">6 days</option>
                  <option value="7">7 days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  After eating all assigned protein/carbs/fats
                </p>
              </div>

              {/* Poor Recovery Days */}
              <div>
                <label htmlFor="poor_recovery_days" className="block text-sm font-medium text-gray-700 mb-1">
                  Poor Recovery Days
                </label>
                <select
                  id="poor_recovery_days"
                  value={formData.poor_recovery_days}
                  onChange={(e) => handleInputChange('poor_recovery_days', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                >
                  <option value="">Select number of days</option>
                  <option value="0">0 days</option>
                  <option value="1">1 day</option>
                  <option value="2">2 days</option>
                  <option value="3">3 days</option>
                  <option value="4">4 days</option>
                  <option value="5">5 days</option>
                  <option value="6">6 days</option>
                  <option value="7">7 days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Total amount of poor recovery days this week
                </p>
              </div>

            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-md font-medium ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
            >
              {loading 
                ? 'Saving...' 
                : isUpdate 
                  ? `Update Week ${formData.week_number} Check-in` 
                  : `Save Week ${formData.week_number} Check-in`
              }
            </button>
          </div>

        </div>

        {/* Tips for week-based tracking */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">💡 Week-Based Tracking Tips:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Week 0 is your initial assessment (completed by Dr. Nick)</li>
            <li>• Complete one check-in per program week (not calendar week)</li>
            <li>• Weight and waist measurements help track body composition changes</li>
            <li>• Consistency in training and nutrition leads to better results</li>
                              <li>• Your data feeds into progress charts for Dr. Nick&apos;s analysis</li>
          </ul>
        </div>

      </div>
    </div>
  )
}