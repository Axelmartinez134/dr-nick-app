// src/app/components/health/charts/WaistTrendChart.tsx
// Chart 4: Waist Circumference (inches) - with trendline

'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'

interface WaistTrendChartProps {
  data: WeeklyCheckin[]
}

export default function WaistTrendChart({ data }: WaistTrendChartProps) {
  // Process waist data
  const chartData = data
    .filter(entry => entry.waist !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      waist: entry.waist,
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
          <p className="text-purple-600">
            {`Waist: ${payload[0].value}" inches`}
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
          📏 Waist Circumference Trend
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No waist measurement data available yet</p>
          <p className="text-sm">Start tracking your weekly waist measurements to see trends</p>
        </div>
      </div>
    )
  }

  // Calculate trend (simple linear regression for trend line)
  const calculateTrend = () => {
    if (chartData.length < 2) return []
    
    const n = chartData.length
    const sumX = chartData.reduce((sum, point) => sum + point.week, 0)
    const sumY = chartData.reduce((sum, point) => sum + (point.waist || 0), 0)
    const sumXY = chartData.reduce((sum, point) => sum + point.week * (point.waist || 0), 0)
    const sumXX = chartData.reduce((sum, point) => sum + point.week * point.week, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    return chartData.map(point => ({
      week: point.week,
      trendWaist: slope * point.week + intercept
    }))
  }

  const trendData = calculateTrend()

  // Combine actual data with trend data
  const combinedData = chartData.map((point, index) => ({
    ...point,
    trendWaist: trendData[index]?.trendWaist
  }))

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📏 Waist Circumference Trend
        </h3>
        <p className="text-sm text-gray-600">
          Waist measurements over time with trend line (measured at belly button level)
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
            label={{ value: 'Waist (inches)', angle: -90, position: 'insideLeft' }}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Actual waist data */}
          <Line 
            type="monotone" 
            dataKey="waist" 
            stroke="#7c3aed" 
            strokeWidth={3}
            dot={{ fill: '#7c3aed', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Actual Waist"
          />
          
          {/* Trend line */}
          {trendData.length > 0 && (
            <Line 
              type="monotone" 
              dataKey="trendWaist" 
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
        <p>• Purple line shows actual weekly waist measurements</p>
        <p>• Red dashed line shows overall trend direction</p>
        <p>• Measure at belly button level with stomach 100% relaxed</p>
        <p>• Waist measurements often show progress when weight plateaus</p>
      </div>
    </div>
  )
}