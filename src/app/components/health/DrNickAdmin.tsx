// src/app/components/health/DrNickAdmin.tsx
// Admin interface for Dr. Nick to manage patient data

'use client'

import { useState, useEffect } from 'react'
import { saveInitialSetup, updateSleepScore, type InitialSetupData, type DrNickUpdateData } from './healthService'
import { getAllPatients } from './adminService'
import UserCreationModal from './UserCreationModal'
import DrNickQueue from './DrNickQueue'


interface Patient {
  id: string
  email: string
  full_name: string
  created_at: string
  patient_password: string
  client_status?: string
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
    date: '',
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
  const [mounted, setMounted] = useState(false)

  // Set mounted and default date after component mounts
  useEffect(() => {
    setMounted(true)
    const today = new Date()
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    setSetupData(prev => ({
      ...prev,
      date: localDate.toISOString().split('T')[0]
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

  // Update client status via admin API
  const updateClientStatus = async (patientId: string, clientStatus: string) => {
    try {
      const res = await fetch('/api/admin/update-patient-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, clientStatus })
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        alert(json?.error || 'Failed to update status')
        return
      }
      await loadPatients()
    } catch (e: any) {
      alert(e?.message || 'Failed to update status')
    }
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
      setSetupMessage('Please select a client')
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
      const today = new Date()
      const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      setSetupData({
        date: localDate.toISOString().split('T')[0],
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
      setSleepMessage('Please select a client')
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

  // Prevent hydration issues by not rendering until mounted
  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ⚙️ Admin Tools
            </h2>
            <p className="text-gray-600">
              Manage Client accounts and setup data
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            ➕ Create New Client
          </button>
        </div>
      </div>

        {/* Client List for Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            👥 Client Passwords ({patients.length} Clients)
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
            placeholder="🔍 Search Clients by name or email..."
          />
        </div>

        {/* Patients Display */}
        {patientsLoading && (
            <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading Clients...</p>
          </div>
        )}

        {patientsError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Error loading Clients: {patientsError}
          </div>
        )}

        {!patientsLoading && !patientsError && filteredPatients.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {patients.length === 0 ? (
              <div>
                <p className="text-lg mb-2">No Clients found</p>
                <p>Create your first Client account to get started!</p>
              </div>
            ) : (
              <p>No Clients match your search criteria</p>
            )}
          </div>
        )}

        {!patientsLoading && !patientsError && filteredPatients.length > 0 && (() => {
          const onboarding = filteredPatients.filter(p => p.client_status === 'Onboarding')
          const current = filteredPatients.filter(p => p.client_status === 'Current')
          const maintenance = filteredPatients.filter(p => p.client_status === 'Maintenance')
          const nutraceutical = filteredPatients.filter(p => p.client_status === 'Nutraceutical')
          const past = filteredPatients.filter(p => p.client_status === 'Past')
          const test = filteredPatients.filter(p => p.client_status === 'Test')

          const renderSection = (title: string, colorClasses: { headerText: string, rowHover: string, badgeBg?: string }, group: Patient[]) => {
            if (group.length === 0) return null
            return (
              <div className="mb-6">
                <h3 className={`text-lg font-semibold mb-4 ${colorClasses.headerText}`}>
                  {title} ({group.length} {group.length === 1 ? 'Client' : 'Clients'})
                </h3>
                <div className="space-y-3">
                  {group.map((patient) => (
                    <div
                      key={patient.id}
                      className={`border border-gray-200 rounded-lg p-4 ${colorClasses.rowHover}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {patient.full_name || 'No name'}
                            </h4>
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
                          <div className="mt-2">
                            <label className="text-xs text-gray-600 mr-2">Status:</label>
                            <select
                              value={patient.client_status || 'Current'}
                              onChange={(e) => updateClientStatus(patient.id, e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900"
                            >
                              <option value="Current">Current</option>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Nutraceutical">Nutraceutical</option>
                              <option value="Onboarding">Onboarding</option>
                              <option value="Past">Past</option>
                              <option value="Test">Test</option>
                            </select>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">
                              Client Password:
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-800 text-white px-3 py-2 rounded font-mono text-lg font-bold">
                                {patient.patient_password || 'N/A'}
                              </span>
                              {patient.patient_password && (
                                <button
                                  onClick={() => copyPassword(patient.patient_password!)}
                                  className="text-blue-600 hover:text-blue-800 text-lg"
                                  title="Copy password"
                                >
                                  📋
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          return (
            <div>
              {renderSection('📋 Currently Onboarding', { headerText: 'text-blue-900', rowHover: 'hover:bg-blue-50' }, onboarding)}
              {renderSection('✅ Current Clients', { headerText: 'text-green-900', rowHover: 'hover:bg-green-50' }, current)}
              {renderSection('🛠️ Maintenance', { headerText: 'text-purple-900', rowHover: 'hover:bg-purple-50' }, maintenance)}
              {renderSection('Nutraceutical Clients', { headerText: 'text-purple-900', rowHover: 'hover:bg-purple-50' }, nutraceutical)}
              {renderSection('📁 Past Clients', { headerText: 'text-gray-900', rowHover: 'hover:bg-gray-50' }, past)}
              {renderSection('🧪 Test', { headerText: 'text-purple-900', rowHover: 'hover:bg-purple-50' }, test)}
            </div>
          )
        })()}
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