// src/app/components/health/charts/PlateauPreventionChart.tsx
// Chart 1: PLATEAU PREVENTION (WEIGHT) - with trendline

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin, calculateLossPercentageRate } from '../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../regressionUtils'

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

  // Calculate regression for loss rate trend line
  const regressionResult = useMemo(() => {
    if (chartData.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    
    const regressionData = chartData.map(d => ({ week: d.week, value: d.lossRate }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Merge trend line data with chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual loss rate data
      const hasActualData = chartData.some(d => d.week === point.week)
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
    
    // Add actual loss rate values
    chartData.forEach(d => {
      if (d.lossRate !== null && d.lossRate !== undefined && !isNaN(d.lossRate)) {
        allValues.push(d.lossRate)
      }
    })
    
    if (allValues.length === 0) return [0, 5] // Default range for percentages
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    
    // For loss rates, we want to show from 0 to a reasonable maximum
    const padding = Math.max(1, maxValue * 0.2) // At least 1% padding
    
    return [0, maxValue + padding]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
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
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: '% Loss Rate', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Original loss rate data line */}
          <Line 
            type="monotone" 
            dataKey="lossRate" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Loss Rate"
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
        <p>• Higher percentages indicate faster weight loss</p>
        <p>• Dark black trend line shows overall loss rate direction</p>
        <p>• Declining trend may signal an approaching plateau</p>
        <p>• Formula: ABS(100 - (Current Week Weight ÷ Previous Week Weight) × 100)</p>
      </div>
    </div>
  )
}