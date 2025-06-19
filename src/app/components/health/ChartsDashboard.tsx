// src/app/components/health/ChartsDashboard.tsx
// Main dashboard combining all 5 charts for Dr. Nick's analysis

'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { getWeeklyDataForCharts, type WeeklyCheckin } from './healthService'

// Props interface
interface ChartsDashboardProps {
  patientId?: string // Optional patient ID for Dr. Nick's use
}

// Dynamically import chart components to avoid SSR issues
const PlateauPreventionChart = dynamic(() => import('./charts/PlateauPreventionChart'), { 
  ssr: false,
  loading: () => <div className="bg-white rounded-lg shadow-md p-6 h-80 flex items-center justify-center text-gray-500">Loading chart...</div>
})

const WeightProjectionChart = dynamic(() => import('./charts/WeightProjectionChart'), { 
  ssr: false,
  loading: () => <div className="bg-white rounded-lg shadow-md p-6 h-96 flex items-center justify-center text-gray-500">Loading chart...</div>
})

const WeightTrendChart = dynamic(() => import('./charts/WeightTrendChart'), { 
  ssr: false,
  loading: () => <div className="bg-white rounded-lg shadow-md p-6 h-80 flex items-center justify-center text-gray-500">Loading chart...</div>
})

const WaistTrendChart = dynamic(() => import('./charts/WaistTrendChart'), { 
  ssr: false,
  loading: () => <div className="bg-white rounded-lg shadow-md p-6 h-80 flex items-center justify-center text-gray-500">Loading chart...</div>
})

const SleepConsistencyChart = dynamic(() => import('./charts/SleepConsistencyChart'), { 
  ssr: false,
  loading: () => <div className="bg-white rounded-lg shadow-md p-6 h-80 flex items-center justify-center text-gray-500">Loading chart...</div>
})

export default function ChartsDashboard({ patientId }: ChartsDashboardProps) {
  // State for chart data
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load data when component mounts or patientId changes
  useEffect(() => {
    if (mounted) {
      loadChartData()
    }
  }, [mounted, patientId])

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
    initialWeight: chartData.find(d => d.week_number === 0)?.initial_weight || 
                   chartData.find(d => d.week_number === 0)?.weight,
    currentWeight: chartData.filter(d => d.weight && d.week_number > 0)
                           .sort((a, b) => b.week_number - a.week_number)[0]?.weight,
    totalWeightLoss: 0,
    hasInitialSetup: chartData.some(d => d.week_number === 0 && (d.initial_weight || d.weight))
  }

  // Calculate total weight loss
  if (stats.initialWeight && stats.currentWeight) {
    stats.totalWeightLoss = Math.round((stats.initialWeight - stats.currentWeight) * 10) / 10
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
            📊 Dr. Nick&apos;s Progress Charts
          </h2>
          <p className="text-gray-600">
            Comprehensive visual analysis of patient progress over time
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Summary Stats */}
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

        {/* Setup Warning */}
        {!stats.hasInitialSetup && (
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

      {/* Chart Information Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Chart Information</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded">
            <h4 className="font-medium text-blue-900">Weight Loss Projections</h4>
            <p className="text-blue-800">Shows 4 different theoretical weight loss rates vs. actual progress</p>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-medium text-green-900">Plateau Prevention</h4>
            <p className="text-green-800">Tracks week-to-week loss percentage to identify plateaus early</p>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <h4 className="font-medium text-purple-900">Weight & Waist Trends</h4>
            <p className="text-purple-800">Basic progress tracking with trend lines for overall direction</p>
          </div>
          <div className="bg-indigo-50 p-3 rounded">
            <h4 className="font-medium text-indigo-900">Sleep Consistency</h4>
            <p className="text-indigo-800">Whoop device data showing sleep quality and recovery patterns</p>
          </div>
          <div className="bg-orange-50 p-3 rounded">
            <h4 className="font-medium text-orange-900">Week-Based Tracking</h4>
            <p className="text-orange-800">All data organized by program weeks (0-16+) for clear progression</p>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <h4 className="font-medium text-red-900">Professional Analysis</h4>
            <p className="text-red-800">Charts designed for medical consultation and progress review</p>
          </div>
        </div>
      </div>

    </div>
  )
}