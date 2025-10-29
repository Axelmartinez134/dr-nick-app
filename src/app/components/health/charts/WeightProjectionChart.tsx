// src/app/components/health/charts/WeightProjectionChart.tsx
// Chart 2: Weight Loss Trend Line vs. Projections - with trendline

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { WeeklyCheckin, generateWeightProjections } from '../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../regressionUtils'

interface WeightProjectionChartProps {
  data: WeeklyCheckin[]
  unitSystem?: 'imperial' | 'metric'
  // Anchors for static projection lines and fixed X range
  initialWeek0Weight?: number | null
  maxWeek?: number | null
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

import { poundsToKilograms } from '../unitCore'

export default function WeightProjectionChart({ data, unitSystem = 'imperial', initialWeek0Weight, maxWeek }: WeightProjectionChartProps) {
  // MOVE ALL HOOKS TO THE TOP - Fix React Rules of Hooks violation
  
  // Process actual weight data - using useMemo to fix dependency warning
  const actualWeightData = useMemo(() => {
    return data
      .filter(entry => entry.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(entry => ({
        week: entry.week_number,
        actualWeight: entry.weight
      }))
  }, [data])

  // Calculate chart data and projections - using useMemo  
  const { initialWeight, chartData } = useMemo(() => {
  // Prefer anchored Week 0 weight if provided; else derive from given data
  const initialWeightEntry = data.find(entry => 
    entry.week_number === 0 && (entry.initial_weight || entry.weight)
  )
  const derivedInitial = initialWeightEntry?.initial_weight || 
                        initialWeightEntry?.weight || 
                        data.find(entry => entry.weight)?.weight
  const baselineInitial = (typeof initialWeek0Weight === 'number' && !Number.isNaN(initialWeek0Weight))
    ? initialWeek0Weight
    : derivedInitial

  if (!baselineInitial) {
      return { initialWeight: null, chartData: [] }
    }

    // Calculate fixed X extent: prefer anchored maxWeek, else fall back to latest actual (min 16)
    const latestActualWeek = actualWeightData.length > 0 ? Math.max(...actualWeightData.map(d => d.week)) : 0
    const xMax = (typeof maxWeek === 'number' && maxWeek !== null)
      ? maxWeek
      : Math.max(16, latestActualWeek)

    // Generate projection data over fixed X extent
    const projections = generateWeightProjections(baselineInitial, xMax)
    const chartData: any[] = []

  for (let week = 0; week <= xMax; week++) {
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

    return { initialWeight: baselineInitial, chartData }
  }, [data, actualWeightData, initialWeek0Weight, maxWeek])

  // Calculate regression for actual weight trend line
  const regressionResult = useMemo(() => {
    if (actualWeightData.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    
    const regressionData = actualWeightData.map(d => ({ week: d.week, value: d.actualWeight! }))
    const minWeek = Math.min(...actualWeightData.map(d => d.week))
    const maxWeekForRegression = Math.max(...actualWeightData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeekForRegression)
  }, [actualWeightData])

  // Add trend line data to chart data - ONLY FOR WEEKS WITH ACTUAL DATA
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual weight data
      const hasActualData = actualWeightData.some(d => d.week === point.week)
      const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
      
      return {
        ...point,
        actualWeightTrendLine: (hasActualData && trendPoint) ? trendPoint.value : null
      }
    })
  }, [chartData, regressionResult, actualWeightData])

  // Calculate Y-axis domain excluding trend line values to prevent skewing - MOVED BEFORE EARLY RETURN
  const calculateYAxisDomain = useMemo(() => {
    const allValues: number[] = []
    
    // Add actual weight values
    actualWeightData.forEach(d => {
      if (d.actualWeight !== null && d.actualWeight !== undefined) {
        allValues.push(d.actualWeight)
        console.log('Adding actual weight:', d.actualWeight, 'from week:', d.week)
      }
    })
    
    // Add all projection values since they now match actual data length
    chartData.forEach(point => {
      ['projection0', 'projection1', 'projection2', 'projection3'].forEach(key => {
        if (point[key] !== null && point[key] !== undefined) {
          allValues.push(point[key])
          console.log('Adding projection value:', point[key], 'from week:', point.week, 'type:', key)
        }
      })
    })
    
    console.log('All Y-axis values:', allValues)
    console.log('Min value:', Math.min(...allValues))
    console.log('Max value:', Math.max(...allValues))
    
    if (allValues.length === 0) return [0, 100]
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = (maxValue - minValue) * 0.1 // 10% padding
    
    return [minValue - padding, maxValue + padding]
  }, [actualWeightData, chartData])

  // Force X axis to start at Week 0; choose max from prop or data
  const xMaxAxis = useMemo(() => {
    if (typeof maxWeek === 'number' && maxWeek !== null) return maxWeek
    return chartData.length > 0 ? Math.max(...chartData.map(p => p.week)) : 0
  }, [maxWeek, chartData])

  // NOW check for early return after ALL hooks are called
  if (!initialWeight) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Filter out the trend line from tooltip display
      const filteredPayload = payload.filter((entry: any) => 
        entry.dataKey !== 'actualWeightTrendLine'
      )
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          {filteredPayload.map((entry: any, index: number) => {
            const raw = typeof entry.value === 'number' ? entry.value : null
            const converted = unitSystem === 'metric' ? (raw !== null ? poundsToKilograms(raw) : null) : raw
            const display = converted !== null ? Math.round((converted as number) * 10) / 10 : 'N/A'
            return (
              <p key={index} style={{ color: entry.color }}>
                {`${entry.name}: ${display} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}
              </p>
            )
          })}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
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
          Starting weight: {initialWeight ? (unitSystem === 'metric' ? `${(((poundsToKilograms(initialWeight) || 0))).toFixed(2)} kg` : `${initialWeight.toFixed(2)} lbs`) : 'N/A'}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            type="number"
            domain={[0, xMaxAxis] as any}
            allowDecimals={false}
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain}
            tickFormatter={(value: number) => `${unitSystem === 'metric' ? (Math.round((poundsToKilograms(value) || 0) * 10) / 10) : (Math.round(value * 10) / 10)}`}
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
            name={unitSystem === 'metric' ? 'Actual Weight (kg)' : 'Actual Weight (lbs)'}
            connectNulls={true}
          />
          
          {/* Actual weight trend line - Dark black as requested */}
          {regressionResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="actualWeightTrendLine" 
              stroke="#000000" 
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name=""
              connectNulls={true}
              legendType="none"
            />
          )}
          
          {/* Projection lines - dotted opaque lines in different colors */}
          <Line 
            type="linear" 
            dataKey="projection0" 
            stroke="#10b981" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="0.5% Loss/Week"
            opacity={0.7}
          />
          <Line 
            type="linear" 
            dataKey="projection1" 
            stroke="#3b82f6" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="1.0% Loss/Week"
            opacity={0.7}
          />
          <Line 
            type="linear" 
            dataKey="projection2" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="1.5% Loss/Week"
            opacity={0.7}
          />
          <Line 
            type="linear" 
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
        <p>• Dark black trend line shows actual weight trajectory</p>
        <p>• Dotted lines show theoretical projections at different rates of progress all originating from the same starting weight.</p>
        <p>• Projections help identify if progress is on track with expectations</p>
      </div>
    </div>
  )
}