// src/app/components/health/charts/BodyFatPercentageChart.tsx
// Chart: Body Fat Percentage - From Fit 3-D scans scheduled with Dr. Nick

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'

interface BodyFatPercentageChartProps {
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

export default function BodyFatPercentageChart({ data }: BodyFatPercentageChartProps) {
  // Process body fat percentage data only (exclude null values for calculation, but keep for display)
  const chartData = useMemo(() => {
    return data
      .filter(entry => entry.body_fat_percentage !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(entry => ({
        week: entry.week_number,
        bodyFat: entry.body_fat_percentage,
        date: new Date(entry.date).toLocaleDateString()
      }))
  }, [data])

  // Calculate Y-axis domain starting from first data point
  const calculateYAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100]
    
    const allValues = chartData
      .map(d => d.bodyFat)
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
          <p className="text-blue-600">
            {`Body Fat: ${payload[0].value}%`}
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
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip 
          title="Body Fat Percentage" 
          description="Your body fat percentage tracks changes in body composition beyond just weight. This precise measurement shows how much of your weight loss comes from fat versus muscle, helping optimize your program for the best results."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors">
            📊 Body Fat Percentage
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No body fat percentage data available yet</p>
          <p className="text-sm">Body composition scans will be scheduled based on your progress</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-4">
        <ChartTooltip 
          title="Body Fat Percentage" 
          description="Your body fat percentage tracks changes in body composition beyond just weight. This precise measurement shows how much of your weight loss comes from fat versus muscle, helping optimize your program for the best results."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
            📊 Body Fat Percentage
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Your body fat percentage tracks changes in body composition beyond just weight. This shows how much of your progress comes from fat loss versus muscle.
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
            label={{ value: 'Body Fat %', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Line 
            type="monotone" 
            dataKey="bodyFat" 
            stroke="#2563eb" 
            strokeWidth={3}
            dot={{ fill: '#2563eb', strokeWidth: 2, r: 6 }}
            activeDot={{ r: 8 }}
            name="Body Fat %"
            connectNulls={true}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Measured using the most precise testing methodology Dr. Nick has determined available in your situation</p>
        <p>• Scheduled periodically based on your progress milestones</p>
        <p>• More accurate than weight alone for tracking fat loss</p>
      </div>
    </div>
  )
} 