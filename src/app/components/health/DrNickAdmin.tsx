// src/app/components/health/DrNickAdmin.tsx
// Admin interface for Dr. Nick to manage patient data

'use client'

import { useState, useEffect } from 'react'
import { saveInitialSetup, updateSleepScore, type InitialSetupData, type DrNickUpdateData } from './healthService'
import dynamic from "next/dynamic";

const PlateauPreventionChart = dynamic(
  () => import("./charts/PlateauPreventionChart"),
  { ssr: false, loading: () => <div>Loading chart...</div> }
);

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
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patientSearchTerm, setPatientSearchTerm] = useState('')
  const [foundPatients, setFoundPatients] = useState<Array<{id: string, email: string, name?: string}>>([])

  // UI state
  const [setupLoading, setSetupLoading] = useState(false)
  const [sleepLoading, setSleepLoading] = useState(false)
  const [setupMessage, setSetupMessage] = useState('')
  const [sleepMessage, setSleepMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Set mounted and default date after component mounts
  useEffect(() => {
    setMounted(true)
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
    const { data, error } = await saveInitialSetup(setupData, selectedPatientId)

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
    const { data, error } = await updateSleepScore(sleepUpdateData, selectedPatientId)

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
                value={patientSearchTerm}
                onChange={(e) => setPatientSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type patient name or email..."
              />
              <button
                type="button"
                onClick={() => {
                  // Placeholder for future patient search functionality
                  alert('Patient search feature will be implemented with Supabase RLS policies')
                }}
                disabled={searchLoading}
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
              Or Enter Patient User ID Directly
            </label>
            <input
              id="patient_id"
              type="text"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter patient's user ID (UUID format)"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can find patient IDs in the Supabase Authentication section
            </p>
          </div>

          {/* Selected Patient Confirmation */}
          {selectedPatientId && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                ✅ <strong>Selected Patient ID:</strong> {selectedPatientId.slice(0, 8)}...
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Week 0 Initial Setup */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🏁 Week 0 Initial Setup
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Set up patient's starting point for the 16-week program
          </p>

          {/* Setup Message */}
          {setupMessage && (
            <div className={`mb-4 p-3 rounded ${
              setupMessage.includes('successfully') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {setupMessage}
            </div>
          )}

          <div className="space-y-4">
            
            {/* Date */}
            <div>
              <label htmlFor="setup_date" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Assessment Date
              </label>
              <input
                id="setup_date"
                type="date"
                value={setupData.date}
                onChange={(e) => setSetupData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={setupLoading}
              />
            </div>

            {/* Initial Weight */}
            <div>
              <label htmlFor="initial_weight" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Weight (lbs)
              </label>
              <input
                id="initial_weight"
                type="number"
                step="0.1"
                min="0"
                value={setupData.initial_weight}
                onChange={(e) => setSetupData(prev => ({ ...prev, initial_weight: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="185.5"
                disabled={setupLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be used for weight loss projections
              </p>
            </div>

            {/* Optional Initial Sleep Score */}
            <div>
              <label htmlFor="initial_sleep" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Sleep Score (Optional)
              </label>
              <input
                id="initial_sleep"
                type="number"
                min="0"
                max="100"
                value={setupData.sleep_consistency_score}
                onChange={(e) => setSetupData(prev => ({ ...prev, sleep_consistency_score: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="75"
                disabled={setupLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                0-100 scale from Whoop baseline data
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSetupSubmit}
              disabled={setupLoading || !selectedPatientId}
              className={`w-full py-3 px-4 rounded-md font-medium ${
                setupLoading || !selectedPatientId
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
            >
              {setupLoading ? 'Saving...' : 'Save Week 0 Setup'}
            </button>

          </div>
        </div>

        {/* Sleep Score Updates */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            😴 Weekly Sleep Score Updates
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Add weekly sleep consistency data from Whoop device
          </p>

          {/* Sleep Message */}
          {sleepMessage && (
            <div className={`mb-4 p-3 rounded ${
              sleepMessage.includes('successfully') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {sleepMessage}
            </div>
          )}

          <div className="space-y-4">
            
            {/* Week Number */}
            <div>
              <label htmlFor="sleep_week" className="block text-sm font-medium text-gray-700 mb-1">
                Week Number
              </label>
              
              {/* Quick week buttons */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(week => (
                  <button
                    key={week}
                    type="button"
                    onClick={() => setSleepUpdateData(prev => ({ ...prev, week_number: week.toString() }))}
                    className={`px-3 py-1 text-sm rounded ${
                      sleepUpdateData.week_number === week.toString()
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                    disabled={sleepLoading}
                  >
                    {week}
                  </button>
                ))}
              </div>

              <input
                id="sleep_week"
                type="number"
                min="1"
                max="30"
                value={sleepUpdateData.week_number}
                onChange={(e) => setSleepUpdateData(prev => ({ ...prev, week_number: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Week #"
                disabled={sleepLoading}
              />
            </div>

            {/* Sleep Consistency Score */}
            <div>
              <label htmlFor="sleep_score" className="block text-sm font-medium text-gray-700 mb-1">
                Sleep Consistency Score
              </label>
              <input
                id="sleep_score"
                type="number"
                min="0"
                max="100"
                value={sleepUpdateData.sleep_consistency_score}
                onChange={(e) => setSleepUpdateData(prev => ({ ...prev, sleep_consistency_score: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="75"
                disabled={sleepLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                0-100 scale (0=Poor, 40=Fair, 60=Good, 80+=Excellent)
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSleepUpdate}
              disabled={sleepLoading || !selectedPatientId}
              className={`w-full py-3 px-4 rounded-md font-medium ${
                sleepLoading || !selectedPatientId
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white transition-colors`}
            >
              {sleepLoading ? 'Updating...' : `Update Week ${sleepUpdateData.week_number} Sleep Score`}
            </button>

          </div>
        </div>

      </div>

      {/* Instructions Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Instructions</h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Week 0 Initial Setup:</h4>
            <ul className="text-blue-800 space-y-1">
              <li>• Complete this BEFORE patient starts the program</li>
              <li>• Initial weight enables all weight loss projection charts</li>
              <li>• Date should be the consultation/assessment date</li>
              <li>• Optional sleep score provides baseline for comparison</li>
              <li>• Only needs to be done once per patient</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-indigo-900 mb-2">Weekly Sleep Updates:</h4>
            <ul className="text-indigo-800 space-y-1">
              <li>• Add sleep data from patient's Whoop device</li>
              <li>• Can be updated for any week (1-16+)</li>
              <li>• Sleep scores feed into the sleep consistency chart</li>
              <li>• Use Whoop's consistency score (0-100 scale)</li>
              <li>• Update as often as you review Whoop data</li>
            </ul>
          </div>

        </div>

        <div className="mt-4 p-3 bg-yellow-50 rounded">
          <p className="text-yellow-800 text-sm">
            <strong>Patient ID Location:</strong> Go to Supabase → Authentication → Users to find patient User IDs. 
            Copy the UUID (long alphanumeric string) for the correct patient.
          </p>
        </div>
      </div>

    </div>
  )
}