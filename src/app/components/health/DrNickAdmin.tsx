// src/app/components/health/DrNickAdmin.tsx
// Admin interface for Dr. Nick to manage patient data

'use client'

import { useState, useEffect } from 'react'
import { saveInitialSetup, updateSleepScore, type InitialSetupData, type DrNickUpdateData } from './healthService'

export default function DrNickAdmin() {
  // State for initial setup (Week 0)
  const [setupData, setSetupData] = useState<InitialSetupData>({
    date: '', // Will be set after mount
    initial_weight: '',
    sleep_consistency_score: '',
  })

  // State for sleep score updates
  const [sleepUpdateData, setSleepUpdateData] = useState<DrNickUpdateData>({
    week_number: '1',
    sleep_consistency_score: '',
  })

  // Patient selection
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // UI state
  const [setupLoading, setSetupLoading] = useState(false)
  const [sleepLoading, setSleepLoading] = useState(false)
  const [setupMessage, setSetupMessage] = useState('')
  const [sleepMessage, setSleepMessage] = useState('')

  // Set mounted and default date after component mounts
  useEffect(() => {
    setSetupData(prev => ({
      ...prev,
      date: new Date().toISOString().split('T')[0]
    }))
  }, [])

  // Handle initial setup submission
  const handleSetupSubmit = async () => {
    setSetupLoading(true)
    setSetupMessage('')

    // Validation
    if (!selectedPatientId) {
      setSetupMessage('Please enter a patient ID')
      setSetupLoading(false)
      return
    }

    if (!setupData.initial_weight) {
      setSetupMessage('Please enter the initial weight')
      setSetupLoading(false)
      return
    }

    if (isNaN(Number(setupData.initial_weight)) || Number(setupData.initial_weight) <= 0) {
      setSetupMessage('Please enter a valid weight')
      setSetupLoading(false)
      return
    }

    // Save initial setup
    const { error } = await saveInitialSetup(setupData, selectedPatientId)

    if (error) {
      setSetupMessage((error as Error).message || 'Failed to save initial setup')
    } else {
      setSetupMessage('Week 0 initial setup saved successfully!')
      // Clear form
      setSetupData({
        date: new Date().toISOString().split('T')[0],
        initial_weight: '',
        sleep_consistency_score: '',
      })
    }

    setSetupLoading(false)
  }

  // Handle sleep score update submission
  const handleSleepUpdate = async () => {
    setSleepLoading(true)
    setSleepMessage('')

    // Validation
    if (!selectedPatientId) {
      setSleepMessage('Please enter a patient ID')
      setSleepLoading(false)
      return
    }

    if (!sleepUpdateData.week_number) {
      setSleepMessage('Please select a week number')
      setSleepLoading(false)
      return
    }

    if (!sleepUpdateData.sleep_consistency_score) {
      setSleepMessage('Please enter a sleep consistency score')
      setSleepLoading(false)
      return
    }

    const score = parseInt(sleepUpdateData.sleep_consistency_score)
    if (isNaN(score) || score < 0 || score > 100) {
      setSleepMessage('Sleep score must be between 0 and 100')
      setSleepLoading(false)
      return
    }

    // Update sleep score
    const { error } = await updateSleepScore(sleepUpdateData, selectedPatientId)

    if (error) {
      setSleepMessage((error as Error).message || 'Failed to update sleep score')
    } else {
      setSleepMessage(`Sleep score for Week ${sleepUpdateData.week_number} updated successfully!`)
      // Clear sleep score field
      setSleepUpdateData({
        week_number: sleepUpdateData.week_number,
        sleep_consistency_score: '',
      })
    }

    setSleepLoading(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          👨‍⚕️ Dr. Nick Admin Panel
        </h2>
        <p className="text-gray-600">
          Manage patient initial setup and sleep data from Whoop devices
        </p>
      </div>

      {/* Patient Selection - Enhanced */}
      <div className="bg-blue-50 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          👤 Patient Selection
        </h3>
        
        <div className="space-y-4">
          {/* Quick Patient Search */}
          <div>
            <label htmlFor="patient_search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Patient by Name or Email
            </label>
            <div className="flex gap-2">
              <input
                id="patient_search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type patient name or email..."
              />
              <button
                type="button"
                onClick={() => {
                  // Placeholder for future patient search functionality
                  alert('Patient search feature will be implemented with Supabase RLS policies')
                }}
                disabled={setupLoading || sleepLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                🔍 Search
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Feature coming soon - will search patient database securely
            </p>
          </div>

          {/* Manual Patient ID Entry */}
          <div>
            <label htmlFor="patient_id" className="block text-sm font-medium text-gray-700 mb-2">
              Patient ID (Manual Entry)
            </label>
            <input
              id="patient_id"
              type="text"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter patient UUID..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Copy patient ID from the database for now
            </p>
          </div>
        </div>
      </div>

      {/* Week 0 Initial Setup Section */}
      <div className="bg-green-50 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📋 Week 0: Initial Setup
        </h3>
        <p className="text-gray-600 mb-4">
          Set up a new patient&apos;s baseline measurements and assessment date.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Assessment Date */}
          <div>
            <label htmlFor="assessment_date" className="block text-sm font-medium text-gray-700 mb-2">
              Assessment Date
            </label>
            <input
              id="assessment_date"
              type="date"
              value={setupData.date}
              onChange={(e) => setSetupData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Initial Weight */}
          <div>
            <label htmlFor="initial_weight" className="block text-sm font-medium text-gray-700 mb-2">
              Initial Weight (lbs)
            </label>
            <input
              id="initial_weight"
              type="number"
              step="0.1"
              value={setupData.initial_weight}
              onChange={(e) => setSetupData(prev => ({ ...prev, initial_weight: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter weight..."
            />
          </div>

          {/* Sleep Consistency Score (Optional for Week 0) */}
          <div className="md:col-span-2">
            <label htmlFor="initial_sleep" className="block text-sm font-medium text-gray-700 mb-2">
              Sleep Consistency Score (Optional, 0-100)
            </label>
            <input
              id="initial_sleep"
              type="number"
              min="0"
              max="100"
              value={setupData.sleep_consistency_score}
              onChange={(e) => setSetupData(prev => ({ ...prev, sleep_consistency_score: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave blank if not available yet..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Can be added later when Whoop data becomes available
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6">
          <button
            onClick={handleSetupSubmit}
            disabled={setupLoading || !selectedPatientId}
            className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium"
          >
            {setupLoading ? '⏳ Saving...' : '✅ Save Week 0 Setup'}
          </button>
        </div>

        {/* Success/Error Message */}
        {setupMessage && (
          <div className={`mt-4 p-3 rounded-md ${setupMessage.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {setupMessage}
          </div>
        )}
      </div>

      {/* Sleep Score Update Section */}
      <div className="bg-purple-50 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          😴 Sleep Score Updates
        </h3>
        <p className="text-gray-600 mb-4">
          Update weekly sleep consistency scores from Whoop device data.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Week Selection */}
          <div>
            <label htmlFor="week_number" className="block text-sm font-medium text-gray-700 mb-2">
              Week Number
            </label>
            <select
              id="week_number"
              value={sleepUpdateData.week_number}
              onChange={(e) => setSleepUpdateData(prev => ({ ...prev, week_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[...Array(52)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Week {i + 1}
                </option>
              ))}
            </select>
          </div>

          {/* Sleep Score */}
          <div>
            <label htmlFor="sleep_score" className="block text-sm font-medium text-gray-700 mb-2">
              Sleep Consistency Score (0-100)
            </label>
            <input
              id="sleep_score"
              type="number"
              min="0"
              max="100"
              value={sleepUpdateData.sleep_consistency_score}
              onChange={(e) => setSleepUpdateData(prev => ({ ...prev, sleep_consistency_score: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter score from Whoop..."
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6">
          <button
            onClick={handleSleepUpdate}
            disabled={sleepLoading || !selectedPatientId}
            className="w-full md:w-auto px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 font-medium"
          >
            {sleepLoading ? '⏳ Updating...' : '💤 Update Sleep Score'}
          </button>
        </div>

        {/* Success/Error Message */}
        {sleepMessage && (
          <div className={`mt-4 p-3 rounded-md ${sleepMessage.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {sleepMessage}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="bg-yellow-50 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💡 Quick Tips
        </h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Always start with Week 0 setup for new patients</li>
          <li>Sleep scores should be entered weekly from Whoop device data</li>
          <li>Patient ID can be found in the patient database or user account settings</li>
          <li>Initial weight will be used for calculating weight loss progress</li>
          <li>Sleep scores help track recovery and consistency patterns</li>
        </ul>
      </div>
    </div>
  )
}