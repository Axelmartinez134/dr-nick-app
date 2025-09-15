// src/app/components/health/charts/SleepConsistencyChart.tsx
// Chart 5: Sleep Consistency & Recovery (from Whoop data added by Dr. Nick)

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../regressionUtils'

interface SleepConsistencyChartProps {
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

export default function SleepConsistencyChart({ data }: SleepConsistencyChartProps) {
  // Process sleep data
  const chartData = data
    .filter(entry => {
      const v: any = (entry as any).sleep_consistency_score
      if (v === null || v === undefined || v === '') return false
      const n = parseFloat(String(v))
      return !Number.isNaN(n) && Number.isFinite(n)
    })
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      sleepScore: parseFloat(String((entry as any).sleep_consistency_score)),
      date: entry.date // Keep raw date
    }))

  // Calculate regression for trend line (Week 0 to latest week)
  const regressionResult = useMemo(() => {
    const valid = chartData.filter(d => typeof d.sleepScore === 'number' && d.sleepScore !== null && !Number.isNaN(d.sleepScore as number))
    if (valid.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    const regressionData = valid.map(d => ({ week: d.week, value: d.sleepScore as number }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Merge trend line data with chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual sleep data
      const hasActualData = chartData.some(d => d.week === point.week && d.sleepScore !== null)
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
    
    // Add actual sleep score values
    chartData.forEach(d => {
      if (d.sleepScore !== null && d.sleepScore !== undefined && !isNaN(d.sleepScore)) {
        allValues.push(d.sleepScore)
      }
    })
    
    if (allValues.length === 0) return [0, 100] // Default range for sleep scores
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    
    // For sleep scores, we want to show the full 0-100 range with some padding
    const padding = 5 // 5 point padding
    
    return [Math.max(0, minValue - padding), Math.min(100, maxValue + padding)]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Regular tooltip for data points
      const score = payload[0].value

      const formatDate = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        } catch {
          return dateStr
        }
      }
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-gray-800">
            {`Sleep Consistency Score: ${score}/100`}
          </p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">
              {`Date: ${formatDate(payload[0].payload.date)}`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  // Function to get line color based on score
  const getScoreColor = (score: number) => {
    if (score >= 67) return '#10b981' // Green - High Score
    if (score >= 34) return '#eab308' // Yellow - Middle Score
    return '#ef4444' // Red - Low Score
  }

  // Create segments with different colors based on score ranges
  const createColoredSegments = () => {
    if (chartData.length === 0) return null

    return chartData.map((point, index) => {
      const color = getScoreColor(point.sleepScore || 0)
      return (
        <Line
          key={`segment-${index}`}
          type="monotone"
          dataKey="sleepScore"
          stroke={color}
          strokeWidth={3}
          dot={{ fill: color, strokeWidth: 2, r: 5 }}
          activeDot={{ r: 8 }}
          connectNulls={false}
        />
      )
    })
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <ChartTooltip 
          title="Sleep Consistency" 
          description="Sleep quality and recovery biometrics showing your rest patterns. Sleep consistency measures how similar your bed and wake times are over a 4-day period. It's scored on a 0-100% scale where 'low' is under 70%, 'moderate' is between 70% and 80%, and 'high' is 80%+. Consistent sleep-wake times regulate your internal clock, improving sleep quality, metabolism, and immune function."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-indigo-600 transition-colors">
            😴 Sleep Consistency Score
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No sleep data available yet</p>
          <p className="text-sm">Dr. Nick will add sleep consistency scores from your biometric data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip 
          title="Sleep Consistency" 
          description="Sleep quality and recovery biometrics showing your rest patterns. Sleep consistency measures how similar your bed and wake times are over a 4-day period. It's scored on a 0-100% scale where 'low' is under 70%, 'moderate' is between 70% and 80%, and 'high' is 80%+. Consistent sleep-wake times regulate your internal clock, improving sleep quality, metabolism, and immune function."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
            😴 Sleep Consistency Score
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Weekly sleep quality scores from biometric analysis (added by Dr. Nick)
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
            label={{ value: 'Sleep Consistency Score', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value)}`}
          />
          
          {/* Reference lines for score categories */}
          <ReferenceLine y={67} stroke="#10b981" strokeDasharray="2 2" opacity={0.5} />
          <ReferenceLine y={34} stroke="#eab308" strokeDasharray="2 2" opacity={0.5} />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Main sleep score line */}
          <Line 
            type="monotone" 
            dataKey="sleepScore" 
            stroke="#6366f1" 
            strokeWidth={3}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Sleep Score"
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
        <p>• Data sourced from biometric analysis by Dr. Nick</p>
        <p>• Dark black trend line shows overall sleep consistency direction</p>
        <p>• Higher scores indicate better sleep consistency and recovery</p>
        <p>• Sleep consistency directly impacts weight loss and overall progress</p>
      </div>
    </div>
  )
}