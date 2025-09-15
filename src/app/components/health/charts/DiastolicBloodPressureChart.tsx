// src/app/components/health/charts/DiastolicBloodPressureChart.tsx

'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'

interface DiastolicBloodPressureChartProps {
  data: WeeklyCheckin[]
}

function ChartTooltip({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)} className="cursor-help">
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

export default function DiastolicBloodPressureChart({ data }: DiastolicBloodPressureChartProps) {
  const chartData = data
    .filter(entry => entry.diastolic_bp !== null && entry.diastolic_bp !== undefined)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      diastolic: entry.diastolic_bp,
      date: new Date(entry.date).toLocaleDateString()
    }))

  // Dynamic Y-axis domain to avoid 0 baseline; mirror other charts' behavior
  const calculateYAxisDomain = useMemo(() => {
    const values = chartData
      .map(d => (typeof d.diastolic === 'number' ? d.diastolic : null))
      .filter((v): v is number => v !== null && !isNaN(v))

    if (values.length === 0) return [0, 150]

    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(2, (maxValue - minValue) * 0.1)
    return [minValue - padding, maxValue + padding]
  }, [chartData])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-emerald-600">{`Diastolic: ${payload[0].value} mmHg`}</p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">{`Date: ${payload[0].payload.date}`}</p>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <ChartTooltip title="Diastolic Blood Pressure (mmHg)" description="Bottom number — pressure between beats. Tracked weekly.">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-emerald-600 transition-colors">🩺 Diastolic Blood Pressure (mmHg)</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No diastolic readings yet</p>
          <p className="text-sm">Add weekly values to see this chart</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip title="Diastolic Blood Pressure (mmHg)" description="Bottom number — pressure between beats. Tracked weekly.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-emerald-600 transition-colors">🩺 Diastolic Blood Pressure (mmHg)</h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">Weekly diastolic measurements</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'mmHg', angle: -90, position: 'insideLeft' }} domain={calculateYAxisDomain} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="diastolic" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Diastolic (mmHg)" connectNulls={true} />
          {/* Trend line in black, only over actual data weeks */}
          {(() => {
            if (chartData.length < 2) return null
            const minWeek = Math.min(...chartData.map(d => d.week))
            const maxWeek = Math.max(...chartData.map(d => d.week))
            const regression = calculateLinearRegression(
              chartData.map(d => ({ week: d.week, value: d.diastolic as number })),
              minWeek,
              maxWeek
            )
            if (!regression.isValid) return null
            const trendData = chartData.map(point => {
              const tp = regression.trendPoints.find(tp => tp.week === point.week)
              return { ...point, trendLine: tp ? tp.value : null }
            })
            return (
              <Line type="monotone" dataKey="trendLine" stroke="#000000" strokeWidth={2} dot={false} activeDot={false} name="" connectNulls={true} data={trendData as any} />
            )
          })()}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}


