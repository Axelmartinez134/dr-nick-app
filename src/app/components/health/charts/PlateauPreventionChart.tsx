// src/app/components/health/charts/PlateauPreventionChart.tsx
// Chart 1: PLATEAU PREVENTION (WEIGHT) - with trendline

'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin, calculateLossPercentageRate } from '../healthService'

interface PlateauPreventionChartProps {
  data: WeeklyCheckin[]
}

export default function PlateauPreventionChart({ data }: PlateauPreventionChartProps) {
  // Process data to calculate loss percentage rates
  const chartData = data
    .filter(entry => entry.weight !== null && entry.week_number > 0) // Exclude Week 0 and null weights
    .sort((a, b) => a.week_number - b.week_number)
    .map((entry, index, sortedData) => {
      let lossPercentageRate = 0
      
      if (index > 0) {
        const previousWeek = sortedData[index - 1]
        if (previousWeek.weight && entry.weight) {
          lossPercentageRate = calculateLossPercentageRate(entry.weight, previousWeek.weight)
        }
      }
      
      return {
        week: entry.week_number,
        lossRate: Math.round(lossPercentageRate * 100) / 100, // Round to 2 decimal places
        weight: entry.weight
      }
    })

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`Week ${label}`}</p>
          <p className="text-blue-600">
            {`Loss Rate: ${payload[0].value}%`}
          </p>
          {payload[0].payload.weight && (
            <p className="text-gray-600 text-sm">
              {`Weight: ${payload[0].payload.weight} lbs`}
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
          📈 Plateau Prevention (Weight Loss Rate)
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No weight data available yet</p>
          <p className="text-sm">Enter weight data for multiple weeks to see loss rate trends</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📈 Plateau Prevention (Weight Loss Rate)
        </h3>
        <p className="text-sm text-gray-600">
          Tracks week-over-week weight loss percentage to identify potential plateaus
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
            label={{ value: '% Loss Rate', angle: -90, position: 'insideLeft' }}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="lossRate" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Higher percentages indicate faster weight loss</p>
        <p>• Declining trend may signal an approaching plateau</p>
        <p>• Formula: ABS(100 - (Current Week Weight ÷ Previous Week Weight) × 100)</p>
      </div>
    </div>
  )
}