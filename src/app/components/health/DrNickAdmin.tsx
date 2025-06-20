// src/app/components/health/DrNickAdmin.tsx
// Admin interface for Dr. Nick to manage patient data

'use client'

import { useState, useEffect } from 'react'
import { saveInitialSetup, updateSleepScore, type InitialSetupData, type DrNickUpdateData } from './healthService'
import { getAllPatients } from './adminService'
import UserCreationModal from './UserCreationModal'


interface Patient {
  id: string
  email: string
  full_name: string
  created_at: string
  patient_password: string
}

export default function DrNickAdmin() {
  // State for patients
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(true)
  const [patientsError, setPatientsError] = useState('')

  // State for user creation modal
  const [showCreateModal, setShowCreateModal] = useState(false)



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
    loadPatients()
  }, [])

  // Load all patients
  const loadPatients = async () => {
    setPatientsLoading(true)
    setPatientsError('')
    
    const result = await getAllPatients()
    
    if (result.error) {
      setPatientsError(result.error)
    } else {
      setPatients(result.patients)
    }
    
    setPatientsLoading(false)
  }

  // Handle patient creation success
  const handlePatientCreated = () => {
    loadPatients() // Refresh patient list
  }

  // Copy password to clipboard
  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password)
  }

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient =>
    patient.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle initial setup submission
  const handleSetupSubmit = async () => {
    setSetupLoading(true)
    setSetupMessage('')

    // Validation
    if (!selectedPatientId) {
      setSetupMessage('Please select a patient')
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
      setSleepMessage('Please select a patient')
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
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              👨‍⚕️ Dr. Nick Admin Panel
            </h2>
            <p className="text-gray-600">
              Create new patient accounts and manage basic admin functions
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            ➕ Create New Patient
          </button>
        </div>
      </div>

      {/* Patient List with Passwords */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            👥 Patient Management ({patients.length} patients)
          </h3>
          
          <button
            onClick={loadPatients}
            disabled={patientsLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="🔍 Search patients by name or email..."
          />
        </div>

        {/* Patients Display */}
        {patientsLoading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading patients...</p>
          </div>
        )}

        {patientsError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Error loading patients: {patientsError}
          </div>
        )}

        {!patientsLoading && !patientsError && filteredPatients.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {patients.length === 0 ? (
              <div>
                <p className="text-lg mb-2">No patients found</p>
                <p>Create your first patient account to get started!</p>
              </div>
            ) : (
              <p>No patients match your search criteria</p>
            )}
          </div>
        )}

        {!patientsLoading && !patientsError && filteredPatients.length > 0 && (
          <div className="space-y-3">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedPatientId === patient.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPatientId(patient.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {patient.full_name || 'No name'}
                      </h4>
                      {selectedPatientId === patient.id && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-1">
                      📧 {patient.email}
                    </p>
                    
                    <p className="text-xs text-gray-500">
                      Created: {new Date(patient.created_at).toLocaleDateString()}
                    </p>
                    
                    <p className="text-xs text-gray-400 mt-1">
                      ID: {patient.id}
                    </p>
                  </div>

                  {/* Actions Section */}
                  <div className="ml-4 text-right space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">
                        Patient Password:
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-100 px-3 py-1 rounded font-mono text-sm">
                          {patient.patient_password || 'N/A'}
                        </span>
                        {patient.patient_password && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyPassword(patient.patient_password)
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            title="Copy password"
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPatientId(patient.id)
                        }}
                        className={`px-3 py-1 rounded text-sm ${
                          selectedPatientId === patient.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        ⚙️ Select for Admin Tools
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Patient Info */}
      {selectedPatientId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">
            ✅ Selected Patient: {filteredPatients.find(p => p.id === selectedPatientId)?.full_name || 'Unknown'}
          </p>
          <p className="text-green-600 text-sm">
            You can now perform admin actions for this patient below.
          </p>
        </div>
      )}

      {/* Initial Setup Section (Week 0) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Week 0 Initial Setup
        </h3>
        
        {setupMessage && (
          <div className={`mb-4 p-3 rounded ${
            setupMessage.includes('successfully') 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {setupMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="setup_date" className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              id="setup_date"
              type="date"
              value={setupData.date}
              onChange={(e) => setSetupData({...setupData, date: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              disabled={setupLoading}
            />
          </div>

          <div>
            <label htmlFor="initial_weight" className="block text-sm font-medium text-gray-700 mb-2">
              Initial Weight (lbs)
            </label>
            <input
              id="initial_weight"
              type="number"
              step="0.1"
              value={setupData.initial_weight}
              onChange={(e) => setSetupData({...setupData, initial_weight: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="185.5"
              disabled={setupLoading}
            />
          </div>

          <div>
            <label htmlFor="sleep_score" className="block text-sm font-medium text-gray-700 mb-2">
              Sleep Score (0-100)
            </label>
            <input
              id="sleep_score"
              type="number"
              min="0"
              max="100"
              value={setupData.sleep_consistency_score}
              onChange={(e) => setSetupData({...setupData, sleep_consistency_score: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="85"
              disabled={setupLoading}
            />
          </div>
        </div>

        <button
          onClick={handleSetupSubmit}
          disabled={setupLoading || !selectedPatientId}
          className="mt-4 w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {setupLoading ? 'Saving...' : 'Save Week 0 Setup'}
        </button>
      </div>

      {/* Sleep Score Update Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          😴 Update Sleep Consistency Score
        </h3>
        
        {sleepMessage && (
          <div className={`mb-4 p-3 rounded ${
            sleepMessage.includes('successfully') 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {sleepMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="week_number" className="block text-sm font-medium text-gray-700 mb-2">
              Week Number
            </label>
            <select
              id="week_number"
              value={sleepUpdateData.week_number}
              onChange={(e) => setSleepUpdateData({...sleepUpdateData, week_number: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              disabled={sleepLoading}
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(week => (
                <option key={week} value={week.toString()}>Week {week}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sleep_consistency_score" className="block text-sm font-medium text-gray-700 mb-2">
              Sleep Consistency Score (0-100)
            </label>
            <input
              id="sleep_consistency_score"
              type="number"
              min="0"
              max="100"
              value={sleepUpdateData.sleep_consistency_score}
              onChange={(e) => setSleepUpdateData({...sleepUpdateData, sleep_consistency_score: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="From Whoop device..."
              disabled={sleepLoading}
            />
          </div>
        </div>

        <button
          onClick={handleSleepUpdate}
          disabled={sleepLoading || !selectedPatientId}
          className="mt-4 w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
        >
          {sleepLoading ? 'Updating...' : 'Update Sleep Score'}
        </button>
      </div>

      {/* User Creation Modal */}
      <UserCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPatientCreated={handlePatientCreated}
      />
    </div>
  )
}