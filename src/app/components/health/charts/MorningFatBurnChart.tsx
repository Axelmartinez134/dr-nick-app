// src/app/components/health/charts/MorningFatBurnChart.tsx
// Chart: Morning Fat Burn % - Monthly analysis from Lumen device

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'

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
  const description = "Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes and that metabolic adaptation is progressing accordingly."
  // Build calendar-complete series within provided data's min..max week range
  const chartData = useMemo(() => {
    const allWeeksMap = new Map<number, WeeklyCheckin>(data.map(entry => [entry.week_number, entry]))
    const maxWeekNumber = data.length > 0 ? Math.max(...data.map(d => d.week_number)) : 0
    const minWeekNumber = data.length > 0 ? Math.min(...data.map(d => d.week_number)) : 0

    const fullChartData = Array.from({ length: (maxWeekNumber - minWeekNumber + 1) }, (_, idx) => {
      const week = minWeekNumber + idx
      const entry = allWeeksMap.get(week)
      const raw: any = (entry as any)?.morning_fat_burn_percent
      const parsed = raw !== null && raw !== undefined && raw !== '' ? parseFloat(String(raw)) : null
      const value = Number.isNaN(parsed as number) ? null : (parsed as number | null)

      return {
        week,
        fatBurn: value,
        date: entry?.date || (entry as any)?.created_at || ''
      }
    })

    // Do not filter out null weeks — preserve full calendar weeks to avoid x-axis compression
    return fullChartData
  }, [data])

  // Calculate regression for trend line (Week 0 to latest week)
  const regressionResult = useMemo(() => {
    if (chartData.length < 2) {
      return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: '', weeklyChange: 0, totalChange: 0, correlation: 'None' }
    }

    const regressionData = chartData
      .filter(d => d.fatBurn !== null)
      .map(d => ({ week: d.week, value: d.fatBurn as number }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))

    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Merge trend line data with chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))

    return chartData.map(point => {
      const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
      return {
        ...point,
        trendLine: trendPoint ? trendPoint.value : null
      }
    })
  }, [chartData, regressionResult])

  // Calculate Y-axis domain starting from first data point
  const calculateYAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100]
    
    const allValues = chartData
      .map(d => d.fatBurn)
      .filter(val => val !== null && val !== undefined && !isNaN(val as number)) as number[]
    
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
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip 
          title="Morning Fat Burn %" 
          description={description}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-orange-600 transition-colors">
            🔥 Morning Fat Oxidation %
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
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-4">
        <ChartTooltip 
          title="Morning Fat Burn %" 
          description={description}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 transition-colors">
            🔥 Morning Fat Oxidation %
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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

          {/* Continuous regression trend line across full week range */}
          {regressionResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="value" 
              data={regressionResult.trendPoints as any}
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
        <p>• Measured weekly through metabolic analysis</p>
        <p>• Higher percentages over time indicate your body is responding to Dr. Nick's program changes</p>
        <p>• Shows how well your body burns fat in a fasted state</p>
      </div>
    </div>
  )
} 