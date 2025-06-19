// src/app/components/health/charts/WeightTrendChart.tsx
// Chart 3: Weight - with trendline

'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'

interface WeightTrendChartProps {
  data: WeeklyCheckin[]
}

export default function WeightTrendChart({ data }: WeightTrendChartProps) {
  // Process weight data
  const chartData = data
    .filter(entry => entry.weight !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      weight: entry.weight,
      date: new Date(entry.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }))

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`Week ${label}`}</p>
          <p className="text-blue-600">
            {`Weight: ${payload[0].value} lbs`}
          </p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">
              {`Date: ${payload[0].payload.date}`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          ⚖️ Weight Trend
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No weight data available yet</p>
          <p className="text-sm">Start tracking your weekly weight to see trends</p>
        </div>
      </div>
    )
  }

  // Calculate trend (simple linear regression for trend line)
  const calculateTrend = () => {
    if (chartData.length < 2) return []
    
    const n = chartData.length
    const sumX = chartData.reduce((sum, point) => sum + point.week, 0)
    const sumY = chartData.reduce((sum, point) => sum + (point.weight || 0), 0)
    const sumXY = chartData.reduce((sum, point) => sum + point.week * (point.weight || 0), 0)
    const sumXX = chartData.reduce((sum, point) => sum + point.week * point.week, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    return chartData.map(point => ({
      week: point.week,
      trendWeight: slope * point.week + intercept
    }))
  }

  const trendData = calculateTrend()

  // Combine actual data with trend data
  const combinedData = chartData.map((point, index) => ({
    ...point,
    trendWeight: trendData[index]?.trendWeight
  }))

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ⚖️ Weight Trend
        </h3>
        <p className="text-sm text-gray-600">
          Overall weight progression with trend line showing general direction
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft' }}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Actual weight data */}
          <Line 
            type="monotone" 
            dataKey="weight" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Actual Weight"
          />
          
          {/* Trend line */}
          {trendData.length > 0 && (
            <Line 
              type="monotone" 
              dataKey="trendWeight" 
              stroke="#ef4444" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Trend"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Blue line shows actual weekly weights</p>
        <p>• Red dashed line shows overall trend direction</p>
        <p>• Week 0 represents initial assessment by Dr. Nick</p>
      </div>
    </div>
  )
}