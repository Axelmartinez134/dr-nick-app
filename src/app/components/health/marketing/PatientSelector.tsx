// src/app/components/health/marketing/PatientSelector.tsx
// Patient selection component with anonymized data

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../auth/AuthContext'

interface PatientSelectorProps {
  selectedPatientId: string
  onPatientSelect: (patientId: string) => void
}

interface PatientOption {
  id: string
  displayName: string
  current_week: number
  total_checkins: number
}

export default function PatientSelector({ selectedPatientId, onPatientSelect }: PatientSelectorProps) {
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    setLoading(true)
    setError('')

    try {
      // Get all unique user_ids from health_data
      const { data: healthData, error: healthError } = await supabase
        .from('health_data')
        .select('user_id, week_number')
        .order('week_number', { ascending: false })

      if (healthError) throw healthError

      // Get unique user IDs and calculate stats
      const userStats = new Map<string, { maxWeek: number; totalCheckins: number }>()
      
      healthData?.forEach(record => {
        const userId = record.user_id
        const weekNumber = record.week_number
        
        if (!userStats.has(userId)) {
          userStats.set(userId, { maxWeek: weekNumber, totalCheckins: 1 })
        } else {
          const stats = userStats.get(userId)!
          stats.maxWeek = Math.max(stats.maxWeek, weekNumber)
          stats.totalCheckins += 1
        }
      })

      // Get profile data for these users to show real names
      const uniqueUserIds = Array.from(userStats.keys())
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', uniqueUserIds)

      if (profilesError) throw profilesError

      // Create patient options with real names
      const patientOptions: PatientOption[] = uniqueUserIds.map(userId => {
        const stats = userStats.get(userId)!
        const profile = profilesData?.find(p => p.id === userId)
        
        return {
          id: userId,
          displayName: profile?.full_name || profile?.email || `Patient ${userId.slice(0, 8)}`,
          current_week: stats.maxWeek,
          total_checkins: stats.totalCheckins
        }
      })

      // Sort by current week (most advanced first)
      patientOptions.sort((a, b) => b.current_week - a.current_week)

      setPatients(patientOptions)
    } catch (err) {
      setError((err as Error).message || 'Failed to load patients')
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-600 mt-2">Loading patients...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Select a patient to preview their progress charts
      </p>
      
      <select
        value={selectedPatientId}
        onChange={(e) => onPatientSelect(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
      >
        <option value="">Select a patient...</option>
        {patients.map(patient => (
          <option key={patient.id} value={patient.id}>
            {patient.displayName} (Week {patient.current_week}, {patient.total_checkins} check-ins)
          </option>
        ))}
      </select>

      {selectedPatientId && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            ✅ Selected: {patients.find(p => p.id === selectedPatientId)?.displayName}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Charts will be ready for marketing content creation
          </div>
        </div>
      )}
    </div>
  )
} 