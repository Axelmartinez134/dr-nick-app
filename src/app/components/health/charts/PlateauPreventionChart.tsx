// src/app/components/health/charts/PlateauPreventionChart.tsx
// Chart 1: PLATEAU PREVENTION (WEIGHT) - with trendline

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
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

  // Process data to calculate plateau prevention using Dr. Nick's progressive averaging method
  const chartData = useMemo(() => {
    // Include Week 0 in sorting for baseline calculations but filter out null weights
    const allWeeks = data
      .filter(entry => entry.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
    
    // Step 1: Calculate individual week losses for all weeks (including Week 1 from Week 0)
    const individualLosses: { week: number; individualLoss: number; weight: number }[] = []
    
    for (let i = 1; i < allWeeks.length; i++) {
      const currentWeek = allWeeks[i]
      const previousWeek = allWeeks[i - 1]
      
      if (currentWeek.weight && previousWeek.weight && currentWeek.week_number > 0) {
        // Individual week loss = ((previousWeight - currentWeight) / previousWeight) × 100
        const individualLoss = ((previousWeek.weight - currentWeek.weight) / previousWeek.weight) * 100
        
        individualLosses.push({
          week: currentWeek.week_number,
          individualLoss: individualLoss,
          weight: currentWeek.weight
        })
      }
    }
    
    // Step 2: Calculate plateau prevention values using progressive averaging
    const plateauPreventionData = individualLosses.map((entry, index) => {
      let plateauPreventionValue = 0
      
      if (entry.week === 1) {
        // Week 1: Just the individual week loss
        plateauPreventionValue = entry.individualLoss
      } else if (entry.week === 2) {
        // Week 2: Average of weeks 1 and 2
        const week1Loss = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        plateauPreventionValue = (week1Loss + entry.individualLoss) / 2
      } else if (entry.week === 3) {
        // Week 3: Average of weeks 1, 2, and 3
        const week1Loss = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        const week2Loss = individualLosses.find(w => w.week === 2)?.individualLoss || 0
        plateauPreventionValue = (week1Loss + week2Loss + entry.individualLoss) / 3
      } else if (entry.week === 4) {
        // Week 4: Average of weeks 1, 2, 3, and 4
        const week1Loss = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        const week2Loss = individualLosses.find(w => w.week === 2)?.individualLoss || 0
        const week3Loss = individualLosses.find(w => w.week === 3)?.individualLoss || 0
        plateauPreventionValue = (week1Loss + week2Loss + week3Loss + entry.individualLoss) / 4
      } else {
        // Week 5+: Rolling 4-week average of most recent weeks only
        const currentWeekIndex = individualLosses.findIndex(w => w.week === entry.week)
        const last4Weeks = individualLosses.slice(Math.max(0, currentWeekIndex - 3), currentWeekIndex + 1)
        const sum = last4Weeks.reduce((acc, w) => acc + w.individualLoss, 0)
        plateauPreventionValue = sum / last4Weeks.length
      }
      
      return {
        week: entry.week,
        lossRate: Math.round(plateauPreventionValue * 100) / 100, // Round to 2 decimal places
        individualLoss: Math.round(entry.individualLoss * 100) / 100, // Store individual loss for tooltip
        weight: entry.weight
      }
    })
    
    return plateauPreventionData
  }, [data])

  // Calculate horizontal average line (mean of all plateau prevention values)
  const averageLineResult = useMemo(() => {
    if (chartData.length === 0) return { isValid: false, averageValue: 0 }
    
    // Calculate the average of all plateau prevention values
    const sum = chartData.reduce((acc, d) => acc + d.lossRate, 0)
    const averageValue = sum / chartData.length
    
    return {
      isValid: true,
      averageValue: Math.round(averageValue * 100) / 100 // Round to 2 decimal places
    }
  }, [chartData])

  // Add horizontal average line to chart data
  const enhancedChartData = useMemo(() => {
    if (!averageLineResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    // Add the horizontal average line value to each data point
    return chartData.map(point => ({
      ...point,
      trendLine: averageLineResult.averageValue
    }))
  }, [chartData, averageLineResult])

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

  // Custom label renderer for right-edge average text inside chart
  const AvgRightLabel = ({ viewBox, value }: any) => {
    const { x, y, width } = viewBox || {}
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null
    const labelX = x + width - 8 // 8px padding from right edge
    const labelY = y - 6 // small upward nudge to reduce overlap with points
    return (
      <text x={labelX} y={labelY} textAnchor="end" fontSize={12} fontWeight={600} fill="#000000">
        {`Avg: ${Number(value).toFixed(2)}%`}
      </text>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-blue-600">
            {`Plateau Prevention: ${payload[0].value}%`}
          </p>
          {data.individualLoss !== undefined && (
            <p className="text-green-600 text-sm">
              {`Individual Week Loss: ${data.individualLoss}%`}
            </p>
          )}
          {data.weight && (
            <p className="text-gray-600 text-sm">
              {`Weight: ${data.weight} lbs`}
            </p>
          )}
          <div className="text-xs text-gray-500 mt-1 border-t pt-1">
            {label <= 1 && "= Individual week loss"}
            {label === 2 && "= Avg of weeks 1-2"} 
            {label === 3 && "= Avg of weeks 1-3"}
            {label === 4 && "= Avg of weeks 1-4"}
            {label > 4 && "= Rolling 4-week average"}
          </div>
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
          description="Tracks average weekly weight loss percentage using progressive averaging (weeks 1-4) then rolling 4-week averages (week 5+) to identify plateaus early. Declining trends may signal program adjustments are needed."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-green-600 transition-colors">
            📈 Plateau Prevention (Weight Loss Rate)
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No weight data available yet</p>
          <p className="text-sm">Enter weight data for multiple weeks to see plateau prevention analysis</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <ChartTooltip 
          title="Plateau Prevention" 
          description="Tracks week-to-week loss percentage to identify plateaus early. Any data point trends approaching 0% may require program adjustments."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-green-600 transition-colors">
            📈 Plateau Prevention (Weight Loss Rate)
          </h3>
        </ChartTooltip>
        <p className="text-sm text-gray-600">
          Tracks average weight loss percentage using progressive averaging to identify potential plateaus
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
            label={{ value: '% Loss Rate', angle: -90, position: 'insideLeft', offset: -10 }}
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
          
          {/* Horizontal average line - Dark black */}
          {averageLineResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="trendLine" 
              stroke="#000000" 
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name="Average Line"
              connectNulls={true}
          />
          )}
          {/* Right-edge always-visible label for the average line using an invisible ReferenceLine */}
          {averageLineResult.isValid && (
            <ReferenceLine y={averageLineResult.averageValue} strokeOpacity={0} label={<AvgRightLabel value={averageLineResult.averageValue} />} />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Right-edge label now rendered via ReferenceLine label inside the chart */}

      <div className="mt-4 text-xs text-gray-500">
        <p>• Tracks average weekly weight loss % over time to detect plateaus early</p>
        <p>• Week 1-4: Progressive averaging (Week 2 = avg of weeks 1-2, Week 3 = avg of weeks 1-3, etc.)</p>
        <p>• Week 5+: Rolling 4-week average of most recent weeks only</p>
        <p>• Dark black line shows average plateau prevention across all weeks</p>
        <p>• Points above the line indicate better than average performance</p>
        <p>• Individual Week Formula: ((Previous Weight - Current Weight) ÷ Previous Weight) × 100</p>
      </div>
    </div>
  )
}