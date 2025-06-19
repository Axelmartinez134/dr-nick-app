// src/app/components/health/HealthDashboard.tsx
// Dashboard to display weekly check-ins for Dr. Nick

'use client'

import { useState, useEffect } from 'react'
import { getWeeklyCheckins, deleteWeeklyCheckin, type WeeklyCheckin } from './healthService'
import ChartsDashboard from './ChartsDashboard'

export default function HealthDashboard() {
  // State for weekly check-in data
  const [checkins, setCheckins] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTimeRange, setSelectedTimeRange] = useState('90') // days

  // Load data when component mounts or time range changes
  useEffect(() => {
    loadCheckinData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Function to load weekly check-in data
  const loadCheckinData = async () => {
    setLoading(true)
    setError('')

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(selectedTimeRange))
    const startDateString = startDate.toISOString().split('T')[0]

    const { data, error: fetchError } = await getWeeklyCheckins(startDateString, endDate)

    if (fetchError) {
      setError((fetchError as Error).message || 'Failed to load check-in data')
    } else {
      setCheckins(data || [])
    }

    setLoading(false)
  }

  // Function to delete a record
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this check-in?')) {
      return
    }

    const { error: deleteError } = await deleteWeeklyCheckin(id)

    if (deleteError) {
      setError((deleteError as Error).message || 'Failed to delete check-in')
    } else {
      // Reload data
      loadCheckinData()
    }
  }

  // Calculate statistics
  const stats = {
    totalCheckins: checkins.length,
    avgWeight: checkins.filter(c => c.weight).length > 0 
      ? (checkins.filter(c => c.weight).reduce((sum, c) => sum + (c.weight || 0), 0) / checkins.filter(c => c.weight).length).toFixed(1)
      : 'N/A',
    avgWaist: checkins.filter(c => c.waist).length > 0
      ? (checkins.filter(c => c.waist).reduce((sum, c) => sum + (c.waist || 0), 0) / checkins.filter(c => c.waist).length).toFixed(1)
      : 'N/A',
    avgResistanceTraining: checkins.filter(c => c.resistance_training_days !== null).length > 0
      ? (checkins.filter(c => c.resistance_training_days !== null).reduce((sum, c) => sum + (c.resistance_training_days || 0), 0) / checkins.filter(c => c.resistance_training_days !== null).length).toFixed(1)
      : 'N/A',
    avgHungerDays: checkins.filter(c => c.hunger_days !== null).length > 0
      ? (checkins.filter(c => c.hunger_days !== null).reduce((sum, c) => sum + (c.hunger_days || 0), 0) / checkins.filter(c => c.hunger_days !== null).length).toFixed(1)
      : 'N/A',
    avgPoorRecoveryDays: checkins.filter(c => c.poor_recovery_days !== null).length > 0
      ? (checkins.filter(c => c.poor_recovery_days !== null).reduce((sum, c) => sum + (c.poor_recovery_days || 0), 0) / checkins.filter(c => c.poor_recovery_days !== null).length).toFixed(1)
      : 'N/A'
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading your check-in data...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              📋 Dr. Nick Check-in Dashboard
            </h2>
            <p className="text-gray-600">
              Track your weekly progress for Dr. Nick appointments
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Range
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">Last 30 days</option>
              <option value="60">Last 2 months</option>
              <option value="90">Last 3 months</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCheckins}</div>
            <div className="text-sm text-blue-800">Total Check-ins</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.avgWeight}</div>
            <div className="text-sm text-green-800">Avg Weight (lbs)</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.avgWaist}</div>
            <div className="text-sm text-purple-800">Avg Waist (in)</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600">{stats.avgResistanceTraining}</div>
            <div className="text-sm text-indigo-800">Avg Training Days</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.avgHungerDays}</div>
            <div className="text-sm text-orange-800">Avg Hunger Days</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.avgPoorRecoveryDays}</div>
            <div className="text-sm text-red-800">Avg Recovery Issues</div>
          </div>
        </div>
      </div>

      {/* Charts Section - Always show charts */}
      <ChartsDashboard />

      {/* Data Table */}
      {checkins.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Check-ins</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Weight</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Waist</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Training Days</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Heart Rate Training</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Hunger Days</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Recovery Issues</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((checkin) => (
                  <tr key={checkin.id} className="border-t">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(checkin.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {checkin.weight ? `${checkin.weight.toFixed(1)} lbs` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {checkin.waist ? `${checkin.waist.toFixed(1)}"` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {checkin.resistance_training_days !== null ? `${checkin.resistance_training_days}/5` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {checkin.focal_heart_rate_training || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {checkin.hunger_days !== null ? `${checkin.hunger_days} days` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {checkin.poor_recovery_days !== null ? `${checkin.poor_recovery_days} days` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => handleDelete(checkin.id!)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}