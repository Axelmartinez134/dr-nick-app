// src/app/components/health/CreateUserForm.tsx
// Form for Dr. Nick to create new patient accounts with Week 0 baseline

'use client'

import { useState } from 'react'
import { createPatientAccount, type PatientCreationData, type WeekZeroData } from './adminService'

interface CreateUserFormProps {
  onSuccess: (credentials: { email: string; password: string }, fullName: string) => void
  onCancel: () => void
}

export default function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    weight: '',
    waist: '',
    height: '',
    initialNotes: '',
    weightChangeGoalPercent: '1.00',
    proteinGoalGrams: '150',
    resistanceTrainingGoal: '0'
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError('Patient name is required')
      return false
    }

    if (!formData.email.trim()) {
      setError('Email is required')
      return false
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }

    if (!formData.password.trim()) {
      setError('Password is required')
      return false
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }

    if (!formData.weight.trim()) {
      setError('Starting weight is required for Week 0 baseline')
      return false
    }

    if (!formData.waist.trim()) {
      setError('Starting waist measurement is required for Week 0 baseline')
      return false
    }

    if (!formData.height.trim()) {
      setError('Height is required for waist/height ratio calculations')
      return false
    }

    // Validate numeric inputs
    if (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0) {
      setError('Please enter a valid weight')
      return false
    }

    if (isNaN(Number(formData.waist)) || Number(formData.waist) <= 0) {
      setError('Please enter a valid waist measurement')
      return false
    }

    if (isNaN(Number(formData.height)) || Number(formData.height) <= 0) {
      setError('Please enter a valid height')
      return false
    }

    if (isNaN(Number(formData.proteinGoalGrams)) || Number(formData.proteinGoalGrams) < 50 || Number(formData.proteinGoalGrams) > 300) {
      setError('Please enter a valid protein goal between 50-300 grams')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    setError('')

    const weekZeroData: WeekZeroData = {
      weight: formData.weight,
      waist: formData.waist,
      height: formData.height
    }

    const patientData: PatientCreationData = {
      email: formData.email.trim(),
      password: formData.password,
      fullName: formData.fullName.trim(),
      weekZeroData,
      weightChangeGoalPercent: parseFloat(formData.weightChangeGoalPercent) || 1.0,
      proteinGoalGrams: parseInt(formData.proteinGoalGrams) || 150,
      resistanceTrainingGoal: parseInt(formData.resistanceTrainingGoal) || 0,
      drNickCoachingNotes: formData.initialNotes.trim() || undefined
    }

    const result = await createPatientAccount(patientData)

    if (result.success && result.credentials) {
      onSuccess(result.credentials, formData.fullName.trim())
    } else {
      setError(result.error || 'Failed to create patient account')
    }

    setLoading(false)
  }



  return (
    <div className="bg-white rounded-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          ➕ Create New Patient Account
        </h2>
        <p className="text-gray-600">
          Add a new patient with their Week 0 baseline measurements. The system will automatically calculate their weekly check-ins based on submission history.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Patient Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Patient Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient's Full Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="John Doe"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter first and last name together (e.g., "John Doe"). The Monday morning message automations will extract the first name from this field.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="john@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Account will be automatically approved - patient can login immediately after creation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Password *
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Enter password for patient"
              />
              <p className="text-xs text-gray-500 mt-1">
                Patient will use this password to login. You can view it later in the patient list.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight Change Goal (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.10"
                max="5.00"
                value={formData.weightChangeGoalPercent}
                onChange={(e) => handleInputChange('weightChangeGoalPercent', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="1.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Target week-over-week weight loss percentage (e.g., 1.50 = 1.50%)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Protein Goal (grams)
              </label>
              <input
                type="number"
                min="50"
                max="300"
                value={formData.proteinGoalGrams}
                onChange={(e) => handleInputChange('proteinGoalGrams', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="150"
              />
              <p className="text-xs text-gray-500 mt-1">
                Daily protein target in grams (used in Monday morning messages)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resistance Training Goal (days per week)
              </label>
              <input
                type="number"
                min="0"
                max="7"
                value={formData.resistanceTrainingGoal}
                onChange={(e) => handleInputChange('resistanceTrainingGoal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Target resistance training days per week (0-7) - patient will see this as their goal
              </p>
            </div>
          </div>
        </div>

        {/* Week 0 Baseline Data */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Week 0 Baseline Measurements</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starting Weight (lbs) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="185.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starting Waist (inches) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.waist}
                onChange={(e) => handleInputChange('waist', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="34.0"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (inches) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.height}
              onChange={(e) => handleInputChange('height', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="72.0"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Coaching Notes
            </label>
            <textarea
              value={formData.initialNotes}
              onChange={(e) => handleInputChange('initialNotes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              rows={3}
              placeholder="Enter any initial notes about this patient's goals, health conditions, or special considerations..."
            />
            <p className="text-xs text-gray-500 mt-1">
              These notes will appear in all future check-ins with this client. Any changes made here will be reflected in those sections as well.
            </p>
          </div>
        </div>

        {/* Smart Week Calculation Info */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">📊 Smart Week Tracking</h3>
          <p className="text-sm text-gray-700">
            The system will automatically calculate which week the patient should submit based on their submission history:
          </p>
          <ul className="text-sm text-gray-600 mt-2 space-y-1">
            <li>• First submission = Week 1</li>
            <li>• 3-day grace period for late submissions</li>
            <li>• Automatic progression to next week</li>
            <li>• Handles gaps in submission history</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Create Patient Account'}
        </button>
      </div>
    </div>
  )
} 