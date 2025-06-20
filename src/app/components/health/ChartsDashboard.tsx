// src/app/components/health/ChartsDashboard.tsx
// Main dashboard combining all 5 charts for Dr. Nick's analysis

'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { getWeeklyDataForCharts, updateHealthRecord, deleteHealthRecord, type WeeklyCheckin } from './healthService'

// Props interface
interface ChartsDashboardProps {
  patientId?: string // Optional patient ID for Dr. Nick's use
}

// Dynamic imports for charts (client-side only)
const WeightTrendChart = dynamic(() => import('./charts/WeightTrendChart'), { ssr: false })
const WaistTrendChart = dynamic(() => import('./charts/WaistTrendChart'), { ssr: false })
const WeightProjectionChart = dynamic(() => import('./charts/WeightProjectionChart'), { ssr: false })
const PlateauPreventionChart = dynamic(() => import('./charts/PlateauPreventionChart'), { ssr: false })
const SleepConsistencyChart = dynamic(() => import('./charts/SleepConsistencyChart'), { ssr: false })

// Data Table Component - Different versions for Patient vs Dr. Nick
function DataTable({ data, isDoctorView, onDataUpdate }: { 
  data: WeeklyCheckin[], 
  isDoctorView: boolean,
  onDataUpdate?: () => void 
}) {
  const [editingCell, setEditingCell] = useState<{ recordId: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isDoctorView ? "📋 Patient Check-in Data (Editable)" : "📋 Your Check-in Data"}
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No check-in data available yet</p>
          <p className="text-sm">
            {isDoctorView 
              ? "Patient data will appear here after weekly check-ins are completed"
              : "Your data will appear here after completing weekly check-ins"
            }
          </p>
        </div>
      </div>
    )
  }

  // Sort data by week number for display (ascending order - Week 0 at top, new weeks added to bottom)
  const sortedData = [...data].sort((a, b) => a.week_number - b.week_number)

  // Handle cell editing for Dr. Nick
  const handleCellClick = (recordId: string, field: string, currentValue: any) => {
    if (!isDoctorView) return
    
    setEditingCell({ recordId, field })
    setEditValue(currentValue?.toString() || '')
  }

  const handleSaveEdit = async () => {
    if (!editingCell || !onDataUpdate) return

    setSaving(true)
    try {
      const updates = { [editingCell.field]: editValue === '' ? null : editValue }
      await updateHealthRecord(editingCell.recordId, updates)
      onDataUpdate() // Refresh the data
      setEditingCell(null)
    } catch (error) {
      console.error('Error updating record:', error)
      alert('Failed to update record')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const renderCell = (record: WeeklyCheckin, field: string, value: any) => {
    const isEditing = editingCell?.recordId === record.id && editingCell?.field === field
    
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-20 px-2 py-1 text-xs border rounded"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
          />
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="text-green-600 hover:text-green-800 text-xs"
          >
            ✓
          </button>
          <button
            onClick={handleCancelEdit}
            className="text-red-600 hover:text-red-800 text-xs"
          >
            ✕
          </button>
        </div>
      )
    }

    const displayValue = value !== null && value !== undefined ? value.toString() : '—'
    
    return (
      <span
        className={isDoctorView ? "cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded" : ""}
        onClick={() => handleCellClick(record.id!, field, value)}
        title={isDoctorView ? "Click to edit" : ""}
      >
        {displayValue}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {isDoctorView ? "📋 Patient Check-in Data (Editable)" : "📋 Your Check-in Data"}
      </h3>
      <p className="text-gray-600 mb-4">
        {isDoctorView 
          ? "Click any cell to edit patient data. This table shows the raw data used to generate the progress charts above."
          : "This table shows the raw data used to generate your progress charts above"
        }
      </p>
      
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Week</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Weight (lbs)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Waist (in)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Training Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Heart Rate Training</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Hunger Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Recovery Issues</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sleep Score</th>
              {isDoctorView && (
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((record, index) => (
              <tr key={record.id || index} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    record.week_number === 0 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {record.week_number === 0 ? 'Week 0' : `Week ${record.week_number}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(record.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'weight', record.weight)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'waist', record.waist)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'resistance_training_days', record.resistance_training_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'focal_heart_rate_training', record.focal_heart_rate_training)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'hunger_days', record.hunger_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'poor_recovery_days', record.poor_recovery_days)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(record, 'sleep_consistency_score', record.sleep_consistency_score)}
                </td>
                {isDoctorView && (
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={async () => {
                        if (confirm('Delete this record? This cannot be undone.')) {
                          try {
                            await deleteHealthRecord(record.id!)
                            onDataUpdate?.()
                          } catch (error) {
                            alert('Failed to delete record')
                          }
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                      title="Delete record"
                    >
                      🗑️
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p><strong>Note:</strong> Week 0 represents baseline measurements. Sleep scores are added by Dr. Nick from Whoop device data.</p>
        {isDoctorView && (
          <p className="text-blue-600 mt-1">
            <strong>Dr. Nick:</strong> Click any cell to edit values. Press Enter to save, Escape to cancel.
          </p>
        )}
      </div>
    </div>
  )
}

export default function ChartsDashboard({ patientId }: ChartsDashboardProps) {
  // State for chart data
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  // Determine if this is Dr. Nick's view or patient view
  const isDoctorView = !!patientId

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load data when component mounts or patientId changes
  useEffect(() => {
    loadChartData()
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Function to load chart data
  const loadChartData = async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await getWeeklyDataForCharts(patientId)

    if (fetchError) {
      setError((fetchError as Error).message || 'Failed to load chart data')
    } else {
      setChartData(data || [])
    }

    setLoading(false)
  }

  // Don't render until mounted (avoids SSR mismatch)
  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading dashboard...</div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate summary statistics
  const stats = {
    totalWeeks: chartData.length,
    currentWeek: chartData.length > 0 ? Math.max(...chartData.map(d => d.week_number)) : 0,
    hasWeek0: chartData.some(d => d.week_number === 0),
    initialWeight: (() => {
      // First try to find Week 0 with initial_weight
      const week0WithInitial = chartData.find(d => d.week_number === 0 && d.initial_weight);
      if (week0WithInitial?.initial_weight) return week0WithInitial.initial_weight;
      
      // Then try Week 0 with weight
      const week0WithWeight = chartData.find(d => d.week_number === 0 && d.weight);
      if (week0WithWeight?.weight) return week0WithWeight.weight;
      
      // Finally, try the earliest week with weight data
      const earliestWithWeight = chartData
        .filter(d => d.weight)
        .sort((a, b) => a.week_number - b.week_number)[0];
      return earliestWithWeight?.weight || null;
    })(),
    currentWeight: (() => {
      // Get the most recent week with weight data
      const latestWithWeight = chartData
        .filter(d => d.weight)
        .sort((a, b) => b.week_number - a.week_number)[0];
      return latestWithWeight?.weight || null;
    })(),
    totalWeightLoss: 0,
    hasInitialSetup: chartData.some(d => d.week_number === 0 && (d.initial_weight || d.weight))
  }

  // Calculate total weight loss
  if (stats.initialWeight && stats.currentWeight) {
    stats.totalWeightLoss = Math.round((stats.initialWeight - stats.currentWeight) * 10) / 10
  }

  // Debug logging (temporary - remove after testing)
  if (chartData.length > 0) {
    console.log('ChartsDashboard Debug:', {
      totalRecords: chartData.length,
      initialWeight: stats.initialWeight,
      currentWeight: stats.currentWeight,
      totalWeightLoss: stats.totalWeightLoss,
      hasWeek0: stats.hasWeek0,
      hasInitialSetup: stats.hasInitialSetup,
      sampleData: chartData.slice(0, 3).map(d => ({
        week: d.week_number,
        weight: d.weight,
        initial_weight: d.initial_weight,
        date: d.date
      }))
    });
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="text-gray-600">Loading chart data...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header with Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isDoctorView ? "📊 Dr. Nick's Progress Charts" : "📊 My Progress"}
          </h2>
          <p className="text-gray-600">
            {isDoctorView 
              ? "Comprehensive visual analysis of patient progress over time"
              : "Track your journey and see your progress over time"
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Summary Stats - Different for Doctor vs Patient */}
        {isDoctorView ? (
          // Doctor View - Show all stats
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.currentWeek}</div>
              <div className="text-sm text-blue-800">Current Week</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.totalWeeks}</div>
              <div className="text-sm text-green-800">Total Data Points</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.initialWeight ? `${stats.initialWeight} lbs` : 'N/A'}
              </div>
              <div className="text-sm text-purple-800">Starting Weight</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                {stats.currentWeight ? `${stats.currentWeight} lbs` : 'N/A'}
              </div>
              <div className="text-sm text-indigo-800">Current Weight</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalWeightLoss > 0 ? `-${stats.totalWeightLoss} lbs` : 'N/A'}
              </div>
              <div className="text-sm text-orange-800">Total Loss</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {stats.hasInitialSetup ? '✅' : '❌'}
              </div>
              <div className="text-sm text-red-800">Week 0 Setup</div>
            </div>
          </div>
        ) : (
          // Patient View - Remove Total Data Points and Week 0 Setup
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.currentWeek}</div>
              <div className="text-sm text-blue-800">Current Week</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.initialWeight ? `${stats.initialWeight} lbs` : 'N/A'}
              </div>
              <div className="text-sm text-purple-800">Starting Weight</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                {stats.currentWeight ? `${stats.currentWeight} lbs` : 'N/A'}
              </div>
              <div className="text-sm text-indigo-800">Current Weight</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalWeightLoss > 0 ? `-${stats.totalWeightLoss} lbs` : 'N/A'}
              </div>
              <div className="text-sm text-orange-800">Total Loss</div>
            </div>
          </div>
        )}

        {/* Setup Warning - Only for Doctor View */}
        {isDoctorView && !stats.hasInitialSetup && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded">
            <div className="flex items-center">
              <div className="text-yellow-800">
                <strong>⚠️ Setup Required:</strong> Dr. Nick needs to complete the initial Week 0 setup 
                to enable all chart features, especially the weight loss projections.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Grid - Always render charts, they handle empty data themselves */}
      <div className="space-y-6">
        
        {/* Row 1: Weight-Related Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WeightProjectionChart data={chartData} />
          <PlateauPreventionChart data={chartData} />
        </div>

        {/* Row 2: Basic Trend Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WeightTrendChart data={chartData} />
          <WaistTrendChart data={chartData} />
        </div>

        {/* Row 3: Sleep Chart (Full Width) */}
        <div className="grid grid-cols-1">
          <SleepConsistencyChart data={chartData} />
        </div>

        {/* Data Table - Different for Patient vs Dr. Nick */}
        <DataTable 
          data={chartData} 
          isDoctorView={isDoctorView}
          onDataUpdate={loadChartData}
        />

        {/* Chart Refresh Button */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <button
              onClick={loadChartData}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Charts'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Click to reload the latest data from the database
            </p>
          </div>
        </div>

      </div>

      {/* Data status info */}
      {chartData.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-6">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Charts Ready for Data
            </h3>
            <p className="text-gray-600 mb-4">
              The charts above will populate automatically as data is entered.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg max-w-md mx-auto">
              <h4 className="font-medium text-blue-900 mb-2">To Get Started:</h4>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>1. Dr. Nick sets up Week 0 with initial weight</li>
                <li>2. Patient completes weekly check-ins (Weeks 1+)</li>
                <li>3. Dr. Nick adds sleep data from Whoop</li>
                <li>4. Charts automatically populate with data</li>
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}