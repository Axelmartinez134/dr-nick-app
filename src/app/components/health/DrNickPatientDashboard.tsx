// src/app/components/health/DrNickPatientDashboard.tsx
// Dr. Nick's patient management dashboard with patient list and individual charts

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../auth/AuthContext'
import ChartsDashboard from './ChartsDashboard'
import DrNickAdmin from './DrNickAdmin'
import DrNickQueue, { QueueSubmission } from './DrNickQueue'
import DrNickSubmissionReview from './DrNickSubmissionReview'

// Import QueueSubmission interface from DrNickQueue
interface PatientSummary {
  user_id: string
  email: string
  full_name: string | null
  total_checkins: number
  current_week: number
  latest_weight: number | null
  initial_weight: number | null
  weight_loss: number | null
  last_checkin: string | null
  latest_constraints_ok: boolean | null
}

export default function DrNickPatientDashboard() {
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('patients')

  // NEW: Add state for submission review functionality
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedSubmissionData, setSelectedSubmissionData] = useState<QueueSubmission | null>(null)

  // Load all patients and their summary data
  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    setLoading(true)
    setError('')

    try {
      // First, get all unique user_ids from health_data
      const { data: healthData, error: healthError } = await supabase
        .from('health_data')
        .select('user_id, week_number, weight, initial_weight, date, energetic_constraints_reduction_ok')
        .order('date', { ascending: false })

      if (healthError) throw healthError

      // Get unique user IDs
      const uniqueUserIds = [...new Set(healthData?.map(record => record.user_id) || [])]

      if (uniqueUserIds.length === 0) {
        setPatients([])
        setLoading(false)
        return
      }

      // Get profile data for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', uniqueUserIds)

      if (profilesError) throw profilesError

      // Create a map of profiles for quick lookup
      const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || [])

      // Process patient data to create summaries
      const patientMap = new Map<string, PatientSummary>()
      
      healthData?.forEach((record: { user_id: string; week_number: number; weight: number; initial_weight: number; date: string; energetic_constraints_reduction_ok: boolean }) => {
        const userId = record.user_id
        const profile = profilesMap.get(userId)
        
        // Only process records that have matching profiles
        if (!profile) {
          return // Skip if no profile found
        }
        
        if (!patientMap.has(userId)) {
          patientMap.set(userId, {
            user_id: userId,
            email: profile.email || 'Unknown',
            full_name: profile.full_name || null,
            total_checkins: 0,
            current_week: 0,
            latest_weight: null,
            initial_weight: record.initial_weight || null,
            weight_loss: null,
            last_checkin: null,
            latest_constraints_ok: null
          })
        }

        const patient = patientMap.get(userId)!
        patient.total_checkins++
        
        if (record.week_number > patient.current_week) {
          patient.current_week = record.week_number
        }
        
        if (record.weight && (!patient.latest_weight || !patient.last_checkin || record.date > patient.last_checkin)) {
          patient.latest_weight = record.weight
          patient.last_checkin = record.date
        }

        // Update latest constraints preference if this is the most recent record
        if (!patient.last_checkin || record.date >= patient.last_checkin) {
          patient.latest_constraints_ok = record.energetic_constraints_reduction_ok
        }

        // Calculate weight loss if we have both initial and latest
        if (patient.initial_weight && patient.latest_weight) {
          patient.weight_loss = Math.round((patient.initial_weight - patient.latest_weight) * 10) / 10
        }
      })

      const finalPatients = Array.from(patientMap.values()).sort((a, b) => a.email.localeCompare(b.email))
      setPatients(finalPatients)
    } catch (err) {
      setError((err as Error).message || 'Failed to load patients')
    }

    setLoading(false)
  }

  // NEW: Handler functions for submission review workflow
  const handleSubmissionSelect = (submission: QueueSubmission) => {
    setSelectedSubmissionData(submission)
    setSelectedSubmissionId(submission.id)
    setActiveTab('review')
  }

  const handleReviewComplete = () => {
    // Clear review state
    setSelectedSubmissionData(null)
    setSelectedSubmissionId(null)
    // Return to queue tab
    setActiveTab('queue')
    // Note: Queue will auto-refresh and remove completed items
  }

  const handleBackToQueue = () => {
    // Keep submission data but return to queue view
    setActiveTab('queue')
  }



  const selectedPatient = patients.find(p => p.user_id === selectedPatientId)
  const selectedSubmission = selectedSubmissionData

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading patient data...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              👨‍⚕️ Dr. Nick&apos;s Patient Dashboard
            </h1>
            <p className="text-gray-600">
              Manage all your patients and track their progress
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{patients.length}</div>
            <div className="text-sm text-blue-800">Total Patients</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b rounded-lg shadow-md">
        <div className="px-6">
          <div className="flex space-x-8">
            
            <button
              onClick={() => {
                setActiveTab('patients')
                setSelectedPatientId(null)
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'patients'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Patient List
            </button>

            {selectedPatientId && (
              <button
                onClick={() => setActiveTab('charts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'charts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 {selectedPatient?.full_name || selectedPatient?.email}&apos;s Charts
              </button>
            )}

            <button
              onClick={() => {
                setActiveTab('queue')
                // Clear any active submission review when returning to queue
                setSelectedSubmissionData(null)
                setSelectedSubmissionId(null)
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'queue'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Review Queue
            </button>

            {/* NEW: Review Submission Tab - Green highlighting */}
            {selectedSubmissionId && selectedSubmissionData && (
              <button
                onClick={() => setActiveTab('review')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'review'
                    ? 'border-green-500 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-green-50'
                }`}
              >
                🔍 Reviewing {selectedSubmissionData.profiles.first_name} {selectedSubmissionData.profiles.last_name} - Week {selectedSubmissionData.week_number}
              </button>
            )}

            <button
              onClick={() => setActiveTab('admin')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'admin'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ Admin Tools
            </button>

          </div>
        </div>
      </nav>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Content */}
      {activeTab === 'patients' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Patient Overview</h2>
            <button
              onClick={loadPatients}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔄 Refresh
            </button>
          </div>

          {patients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No patients found yet</p>
              <p className="text-sm">Patients will appear here once they start submitting check-ins</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Patient</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Current Week</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Last Check-in</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.user_id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {patient.full_name || 'Unknown Name'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {patient.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Week {patient.current_week}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {patient.last_checkin ? new Date(patient.last_checkin).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            setSelectedPatientId(patient.user_id)
                            setActiveTab('charts')
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          📊 View Charts
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Individual Patient Charts */}
      {activeTab === 'charts' && selectedPatientId && (
        <div>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900">
              Viewing charts for: {selectedPatient?.full_name || selectedPatient?.email}
            </h3>
            <p className="text-sm text-blue-700">
              Patient ID: {selectedPatientId.slice(0, 8)}... | Current Week: {selectedPatient?.current_week}
            </p>
          </div>
          <ChartsDashboard patientId={selectedPatientId} />
        </div>
      )}

      {/* Admin Tools */}
      {activeTab === 'admin' && (
        <DrNickAdmin />
      )}

      {/* Review Queue */}
      {activeTab === 'queue' && (
        <DrNickQueue onSubmissionSelect={handleSubmissionSelect} />
      )}

      {/* NEW: Review Submission Tab Content */}
      {activeTab === 'review' && selectedSubmissionData && (
        <DrNickSubmissionReview 
          submission={selectedSubmissionData}
          onReviewComplete={handleReviewComplete}
          onBackToQueue={handleBackToQueue}
        />
      )}

    </div>
  )
} 