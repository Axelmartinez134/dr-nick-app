// src/app/components/health/charts/MorningFatBurnChart.tsx
// Chart: Morning Fat Burn % - Monthly analysis from Lumen device

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'

interface MorningFatBurnChartProps {
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

export default function MorningFatBurnChart({ data }: MorningFatBurnChartProps) {
  // Process morning fat burn data only (exclude null values for calculation, but keep for display)
  const chartData = useMemo(() => {
    return data
      .filter(entry => entry.morning_fat_burn_percent !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(entry => ({
        week: entry.week_number,
        fatBurn: entry.morning_fat_burn_percent,
        date: new Date(entry.date).toLocaleDateString()
      }))
  }, [data])

  // Calculate Y-axis domain starting from first data point
  const calculateYAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100]
    
    const allValues = chartData
      .map(d => d.fatBurn)
      .filter(val => val !== null && val !== undefined && !isNaN(val!)) as number[]
    
    if (allValues.length === 0) return [0, 100]
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = (maxValue - minValue) * 0.1 || 5 // 10% padding, minimum 5 units
    
    return [Math.max(0, minValue - padding), Math.min(100, maxValue + padding)]
  }, [chartData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-orange-600">
            {`Morning Fat Burn: ${payload[0].value}%`}
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
        <ChartTooltip 
          title="Morning Fat Burn %" 
          description="Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes, and that metabolic adaptation is progressing accordingly."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-orange-600 transition-colors">
            🔥 Morning Fat Burn %
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No morning fat burn data available yet</p>
          <p className="text-sm">Your metabolic data will be analyzed monthly</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip 
          title="Morning Fat Burn %" 
          description="Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes, and that metabolic adaptation is progressing accordingly."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 transition-colors">
            🔥 Morning Fat Burn %
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes, and that metabolic adaptation is progressing accordingly.
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
            label={{ value: 'Fat Burn %', angle: -90, position: 'insideLeft', offset: -10 }}
            domain={calculateYAxisDomain}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Line 
            type="monotone" 
            dataKey="fatBurn" 
            stroke="#ea580c" 
            strokeWidth={3}
            dot={{ fill: '#ea580c', strokeWidth: 2, r: 6 }}
            activeDot={{ r: 8 }}
            name="Fat Burn %"
            connectNulls={true}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Measured monthly through metabolic analysis</p>
        <p>• Higher percentages over time indicate your body is responding to Dr. Nick's program changes</p>
        <p>• Shows how well your body burns fat in a fasted state</p>
      </div>
    </div>
  )
} 