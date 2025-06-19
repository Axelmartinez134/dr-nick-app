// src/app/components/health/charts/SleepConsistencyChart.tsx
// Chart 5: Sleep Consistency Score

'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin } from '../healthService'

interface SleepConsistencyChartProps {
  data: WeeklyCheckin[]
}

export default function SleepConsistencyChart({ data }: SleepConsistencyChartProps) {
  // Process sleep data
  const chartData = data
    .filter(entry => entry.sleep_consistency_score !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      sleepScore: entry.sleep_consistency_score,
      date: entry.date // Keep raw date
    }))

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const score = payload[0].value
      let category = 'Poor'
      let color = '#ef4444'
      
      if (score >= 80) {
        category = 'Excellent'
        color = '#10b981'
      } else if (score >= 60) {
        category = 'Good'
        color = '#3b82f6'
      } else if (score >= 40) {
        category = 'Fair'
        color = '#f59e0b'
      }

      const formatDate = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        } catch {
          return dateStr
        }
      }
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`Week ${label}`}</p>
          <p style={{ color }}>
            {`Sleep Score: ${score}/100`}
          </p>
          <p style={{ color }} className="text-sm">
            {`Category: ${category}`}
          </p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">
              {`Date: ${formatDate(payload[0].payload.date)}`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  // Function to get line color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981' // Green
    if (score >= 60) return '#3b82f6' // Blue
    if (score >= 40) return '#f59e0b' // Orange
    return '#ef4444' // Red
  }

  // Create segments with different colors based on score ranges
  const createColoredSegments = () => {
    if (chartData.length === 0) return null

    return chartData.map((point, index) => {
      const color = getScoreColor(point.sleepScore || 0)
      return (
        <Line
          key={`segment-${index}`}
          type="monotone"
          dataKey="sleepScore"
          stroke={color}
          strokeWidth={3}
          dot={{ fill: color, strokeWidth: 2, r: 5 }}
          activeDot={{ r: 8 }}
          connectNulls={false}
        />
      )
    })
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          😴 Sleep Consistency Score
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No sleep data available yet</p>
          <p className="text-sm">Dr. Nick will add sleep data from Whoop device</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          😴 Sleep Consistency Score
        </h3>
        <p className="text-sm text-gray-600">
          Sleep quality and consistency data from Whoop device (0-100 scale)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Sleep Score (0-100)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          
          {/* Reference lines for score categories */}
          <ReferenceLine y={80} stroke="#10b981" strokeDasharray="2 2" opacity={0.5} />
          <ReferenceLine y={60} stroke="#3b82f6" strokeDasharray="2 2" opacity={0.5} />
          <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="2 2" opacity={0.5} />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Main sleep score line */}
          <Line 
            type="monotone" 
            dataKey="sleepScore" 
            stroke="#6366f1" 
            strokeWidth={3}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Sleep Score"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Score legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
          <span>80-100: Excellent</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
          <span>60-79: Good</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
          <span>40-59: Fair</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
          <span>0-39: Poor</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Data collected from Whoop device and entered by Dr. Nick</p>
        <p>• Higher scores indicate better sleep quality and consistency</p>
        <p>• Dashed lines show score category thresholds</p>
      </div>
    </div>
  )
}