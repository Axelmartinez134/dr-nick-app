// src/app/components/health/charts/WeightProjectionChart.tsx
// Chart 2: Weight Loss Trend Line vs. Projections - with trendline

'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { WeeklyCheckin, generateWeightProjections } from '../healthService'

interface WeightProjectionChartProps {
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

export default function WeightProjectionChart({ data }: WeightProjectionChartProps) {
  // Find initial weight from Week 0 or first available weight
  const initialWeightEntry = data.find(entry => 
    entry.week_number === 0 && (entry.initial_weight || entry.weight)
  )
  
  const initialWeight = initialWeightEntry?.initial_weight || 
                       initialWeightEntry?.weight || 
                       data.find(entry => entry.weight)?.weight

  if (!initialWeight) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <ChartTooltip 
          title="Weight Loss Projections" 
          description="Shows 4 different theoretical weight loss rates vs. actual progress. Helps track if you're meeting expected weight loss goals and identify if adjustments are needed."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors">
            📊 Weight Loss Trend vs. Projections
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No initial weight data available</p>
          <p className="text-sm">Dr. Nick needs to set up Week 0 with initial weight</p>
        </div>
      </div>
    )
  }

  // Generate projection data for 16 weeks
  const projections = generateWeightProjections(initialWeight, 16)

  // Process actual weight data
  const actualWeightData = data
    .filter(entry => entry.weight !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      actualWeight: entry.weight
    }))

  // Create combined dataset for chart
  const maxWeek = Math.max(16, Math.max(...actualWeightData.map(d => d.week)))
  const chartData = []

  for (let week = 0; week <= maxWeek; week++) {
    const dataPoint: any = { week }
    
    // Add actual weight if available
    const actualData = actualWeightData.find(d => d.week === week)
    if (actualData) {
      dataPoint.actualWeight = actualData.actualWeight
    }
    
    // Add projection data
    projections.forEach((projection, index) => {
      const projectionPoint = projection.data.find(p => p.week === week)
      if (projectionPoint) {
        dataPoint[`projection${index}`] = projectionPoint.weight
      }
    })
    
    chartData.push(dataPoint)
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`Week ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value ? Math.round(entry.value * 10) / 10 : 'N/A'} lbs`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip 
          title="Weight Loss Projections" 
          description="Shows 4 different theoretical weight loss rates vs. actual progress. Helps track if you're meeting expected weight loss goals and identify if adjustments are needed."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
            📊 Weight Loss Trend vs. Projections
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Compares actual weight loss (red line) against 4 different fat loss projection rates
        </p>
        <p className="text-sm text-gray-500">
          Starting weight: {initialWeight} lbs
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft' }}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Actual weight data - red irregular line */}
          <Line 
            type="monotone" 
            dataKey="actualWeight" 
            stroke="#ef4444" 
            strokeWidth={4}
            dot={{ fill: '#ef4444', strokeWidth: 2, r: 6 }}
            name="Actual Weight"
            connectNulls={false}
          />
          
          {/* Projection lines - dotted opaque lines in different colors */}
          <Line 
            type="monotone" 
            dataKey="projection0" 
            stroke="#10b981" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="0.5% Loss/Week"
            opacity={0.7}
          />
          <Line 
            type="monotone" 
            dataKey="projection1" 
            stroke="#3b82f6" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="1.0% Loss/Week"
            opacity={0.7}
          />
          <Line 
            type="monotone" 
            dataKey="projection2" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="1.5% Loss/Week"
            opacity={0.7}
          />
          <Line 
            type="monotone" 
            dataKey="projection3" 
            stroke="#f59e0b" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="2.0% Loss/Week"
            opacity={0.7}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Red line shows actual progress (irregular pattern expected)</p>
        <p>• Dotted lines show theoretical projections based on consistent fat loss rates</p>
        <p>• Projections help identify if progress is on track with expectations</p>
      </div>
    </div>
  )
}