// src/app/components/health/charts/PlateauPreventionChart.tsx
// Chart 1: PLATEAU PREVENTION (WEIGHT) - with trendline

'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin, calculateLossPercentageRate } from '../healthService'

interface PlateauPreventionChartProps {
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
        <ChartTooltip 
          title="Plateau Prevention" 
          description="Tracks week-to-week loss percentage to identify plateaus early. Red zones indicate potential plateaus that may require program adjustments."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-green-600 transition-colors">
            📈 Plateau Prevention (Weight Loss Rate)
          </h3>
        </ChartTooltip>
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
        <ChartTooltip 
          title="Plateau Prevention" 
          description="Tracks week-to-week loss percentage to identify plateaus early. Red zones indicate potential plateaus that may require program adjustments."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-green-600 transition-colors">
            📈 Plateau Prevention (Weight Loss Rate)
          </h3>
        </ChartTooltip>
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