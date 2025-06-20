// src/app/components/health/charts/SleepConsistencyChart.tsx
// Chart 5: Sleep Consistency & Recovery (from Whoop data added by Dr. Nick)

'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin } from '../healthService'

interface SleepConsistencyChartProps {
  data: WeeklyCheckin[]
}

// Chart Tooltip Component
function ChartTooltip({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-10 w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg -top-2 left-0 transform -translate-y-full">
          <div className="font-medium mb-1">{title}</div>
          <div className="text-gray-300">{description}</div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
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
        <ChartTooltip 
          title="Sleep Consistency" 
          description="Whoop device data showing sleep quality and recovery patterns. Sleep quality directly impacts weight loss, recovery, and overall health progress."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-indigo-600 transition-colors">
            😴 Sleep Consistency & Recovery
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No sleep data available yet</p>
          <p className="text-sm">Dr. Nick will add sleep consistency scores from your Whoop device data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip 
          title="Sleep Consistency" 
          description="Whoop device data showing sleep quality and recovery patterns. Sleep quality directly impacts weight loss, recovery, and overall health progress."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
            😴 Sleep Consistency & Recovery
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Weekly sleep quality scores from Whoop device (added by Dr. Nick)
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
            label={{ value: 'Sleep Score (%)', angle: -90, position: 'insideLeft' }}
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
        <p>• Data sourced from Whoop device by Dr. Nick</p>
        <p>• Higher scores indicate better sleep quality and recovery</p>
        <p>• Sleep quality directly impacts weight loss and overall progress</p>
      </div>
    </div>
  )
}