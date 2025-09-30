// src/app/components/health/charts/NutritionComplianceChart.tsx

'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'

interface NutritionComplianceChartProps {
  data: WeeklyCheckin[]
}

// Tooltip shell used for title/description like the Sleep chart
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
          <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

export default function NutritionComplianceChart({ data }: NutritionComplianceChartProps) {
  // Prepare chart points from weekly data
  const chartData = data
    .filter(entry => {
      const v: any = (entry as any).nutrition_compliance_days
      if (v === null || v === undefined || v === '') return false
      const n = parseFloat(String(v))
      return !Number.isNaN(n) && Number.isFinite(n)
    })
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      nutritionDays: parseFloat(String((entry as any).nutrition_compliance_days)),
      date: entry.date
    }))

  // Regression trend across full week range
  const regressionResult = useMemo(() => {
    const valid = chartData.filter(d => typeof d.nutritionDays === 'number' && d.nutritionDays !== null && !Number.isNaN(d.nutritionDays as number))
    if (valid.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: '', weeklyChange: 0, totalChange: 0, correlation: 'None' }
    const regressionData = valid.map(d => ({ week: d.week, value: d.nutritionDays as number }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Build full week-range dataset and merge trend line so the trend renders reliably in AreaChart
  const enhancedChartData = useMemo(() => {
    if (chartData.length === 0) return [] as Array<{ week: number; nutritionDays: number | null; date?: string; trendLine: number | null }>

    const minDataWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    const startWeek = Math.max(1, minDataWeek) // Nutrition chart should start at Week 1 (not Week 0)

    const result: Array<{ week: number; nutritionDays: number | null; date?: string; trendLine: number | null }> = []
    for (let w = startWeek; w <= maxWeek; w++) {
      const actual = chartData.find(d => d.week === w)
      const trendPoint = regressionResult.isValid ? regressionResult.trendPoints.find(tp => tp.week === w) : undefined
      result.push({
        week: w,
        nutritionDays: actual ? (actual.nutritionDays as number) : null,
        date: actual?.date,
        trendLine: trendPoint ? trendPoint.value : null
      })
    }
    return result
  }, [chartData, regressionResult])

  // Y-axis domain with small padding, clamped to [0,7]
  const calculateYAxisDomain = () => {
    const values: number[] = []
    enhancedChartData.forEach(d => {
      if (d.nutritionDays !== null && d.nutritionDays !== undefined && !isNaN(d.nutritionDays)) {
        values.push(d.nutritionDays)
      }
    })
    if (values.length === 0) return [0, 7]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = 0.5
    return [Math.max(0, Math.floor(minValue - padding)), Math.min(7, Math.ceil(maxValue + padding))]
  }

  // Custom tooltip formatter like Sleep
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      const formatDate = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        } catch {
          return dateStr
        }
      }
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-gray-800">{`Nutrition Days Goal Met: ${value}/7`}</p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">{`Date: ${formatDate(payload[0].payload.date)}`}</p>
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
          title="Nutrition Compliance"
          description="Number of days this week you hit your macronutrient targets. Consistent nutrition compliance improves metabolic health, supports fat loss, and stabilizes energy across the week."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-indigo-600 transition-colors">
            🍽️ Nutrition Days Goal Met
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No nutrition data available yet</p>
          <p className="text-sm">Your weekly check-ins will populate nutrition compliance days</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip
          title="Nutrition Compliance"
          description="Number of days this week you hit your macronutrient targets. Consistent nutrition compliance improves metabolic health, supports fat loss, and stabilizes energy across the week."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
            🍽️ Nutrition Days Goal Met
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">Weekly nutrition compliance days from your check-ins</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} />
          <YAxis
            label={{ value: 'Nutrition Days Goal Met', angle: -90, position: 'insideLeft', dy: 80 }}
            domain={calculateYAxisDomain()}
            tickCount={8}
            tickFormatter={(v) => `${Math.round(v)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="nutritionDays"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Nutrition Days"
            connectNulls={true}
          />
          {regressionResult.isValid && (
            <Line
              type="monotone"
              dataKey="trendLine"
              stroke="#000000"
              strokeWidth={2}
              z={2}
              dot={false}
              activeDot={false}
              name="Trend Line"
              connectNulls={true}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Weekly totals reflect how many days you met macro goals</p>
        <p>• Dark black trend line shows your overall nutrition consistency direction</p>
        <p>• More compliant days support steadier fat loss and better energy</p>
        <p>• Aim for sustainable progress rather than perfection week-to-week</p>
      </div>
    </div>
  )
}


