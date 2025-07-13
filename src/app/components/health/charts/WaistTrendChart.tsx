// src/app/components/health/charts/WaistTrendChart.tsx
// Chart 4: Waist Trend Analysis - with trendline

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../regressionUtils'

interface WaistTrendChartProps {
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

export default function WaistTrendChart({ data }: WaistTrendChartProps) {
  // Process waist data only
  const chartData = data
    .filter(entry => entry.waist !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      waist: entry.waist,
      date: new Date(entry.date).toLocaleDateString()
    }))

  // Calculate regression for trend line (Week 0 to latest week)
  const regressionResult = useMemo(() => {
    if (chartData.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    
    const regressionData = chartData.map(d => ({ week: d.week, value: d.waist! }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Merge trend line data with chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual waist data
      const hasActualData = chartData.some(d => d.week === point.week && d.waist !== null)
      const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
      
      return {
        ...point,
        trendLine: (hasActualData && trendPoint) ? trendPoint.value : null
      }
    })
  }, [chartData, regressionResult])

  // Calculate Y-axis domain excluding trend line values to prevent skewing
  const calculateYAxisDomain = () => {
    const allValues: number[] = []
    
    // Add actual waist values
    chartData.forEach(d => {
      if (d.waist !== null && d.waist !== undefined && !isNaN(d.waist)) {
        allValues.push(d.waist)
      }
    })
    
    if (allValues.length === 0) return [20, 50] // Default range for waist measurements
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = (maxValue - minValue) * 0.1 // 10% padding
    
    return [minValue - padding, maxValue + padding]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-orange-600">
            {`Waist: ${payload[0].value} inches`}
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
          title="Waist Trend" 
          description="Tracks waist circumference changes over time. Often more reliable than weight for measuring body composition changes and fat loss progress."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-orange-600 transition-colors">
            📏 Waist Trend Analysis
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No waist measurements available yet</p>
          <p className="text-sm">Enter waist measurements to track body composition changes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip 
          title="Waist Trend" 
          description="Tracks waist circumference changes over time. Often more reliable than weight for measuring body composition changes and fat loss progress."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 transition-colors">
            📏 Waist Trend Analysis
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Weekly waist measurements showing body composition changes
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Waist (inches)', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Original waist data line */}
          <Line 
            type="monotone" 
            dataKey="waist" 
            stroke="#f97316" 
            strokeWidth={3}
            dot={{ fill: '#f97316', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Waist"
            connectNulls={true}
          />
          
          {/* Regression trend line - Dark black as requested */}
          {regressionResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="trendLine" 
              stroke="#000000" 
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name="Trend Line"
              connectNulls={true}
          />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Often more accurate than weight for fat loss tracking</p>
        <p>• Dark black trend line shows overall waist measurement direction</p>
        <p>• Measure at the widest part of your waist</p>
        <p>• Consistent measurement location is important</p>
      </div>
    </div>
  )
}