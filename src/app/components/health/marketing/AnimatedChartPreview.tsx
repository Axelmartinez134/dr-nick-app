// src/app/components/health/marketing/AnimatedChartPreview.tsx
// Chart preview with animation controls for marketing content

'use client'

import { useState, useEffect } from 'react'
import { getWeeklyDataForCharts, type WeeklyCheckin } from '../healthService'
import MarketingWeightTrendChart from './charts/MarketingWeightTrendChart'
import MarketingPlateauPreventionChart from './charts/MarketingPlateauPreventionChart'
import MarketingWeightProjectionChart from './charts/MarketingWeightProjectionChart'
import MarketingWaistTrendChart from './charts/MarketingWaistTrendChart'
import MarketingSleepConsistencyChart from './charts/MarketingSleepConsistencyChart'
import MarketingMorningFatBurnChart from './charts/MarketingMorningFatBurnChart'
import MarketingBodyFatPercentageChart from './charts/MarketingBodyFatPercentageChart'

interface AnimatedChartPreviewProps {
  patientId: string
  animationSpeed: string
  isAnimating: boolean
  onAnimationComplete: () => void
}

export default function AnimatedChartPreview({ 
  patientId, 
  animationSpeed, 
  isAnimating, 
  onAnimationComplete 
}: AnimatedChartPreviewProps) {
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load chart data when patient is selected
  useEffect(() => {
    if (patientId) {
      loadChartData()
    } else {
      setChartData([])
    }
  }, [patientId])

  const loadChartData = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await getWeeklyDataForCharts(patientId)
      
      if (fetchError) {
        setError((fetchError as Error).message || 'Failed to load chart data')
      } else {
        setChartData(data || [])
      }
    } catch (err) {
      setError('Failed to load chart data')
    }

    setLoading(false)
  }

  // Calculate animation duration based on speed
  const getAnimationDuration = () => {
    switch (animationSpeed) {
      case 'ultra-fast': return 500
      case 'fast': return 1000
      case 'normal': return 2000
      case 'slow': return 4000
      case 'cinematic': return 8000
      default: return 4000
    }
  }

  if (!patientId) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ready to Create Content
        </h3>
        <p className="text-gray-600">
          Select a Client from the left to preview their progress charts
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading Client data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-2">❌ Error</div>
        <p className="text-gray-600">{error}</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📈</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Data Available
        </h3>
        <p className="text-gray-600">
          This Client doesn't have enough data for chart preview
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Preview Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900">
            📊 Chart Preview
          </h4>
          <p className="text-sm text-gray-600">
            {chartData.length} weeks of data • {animationSpeed} animation
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isAnimating && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Animating...</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Grid - All 7 charts */}
      <div className="space-y-6">
        
        {/* Weight Trend Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingWeightTrendChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

        {/* Plateau Prevention Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingPlateauPreventionChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

        {/* Weight Projection Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingWeightProjectionChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

        {/* Waist Trend Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingWaistTrendChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

        {/* Sleep Consistency Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingSleepConsistencyChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

        {/* Morning Fat Burn Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingMorningFatBurnChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

        {/* Body Fat Percentage Chart */}
        <div className="border border-gray-200 rounded-lg p-4">
          <MarketingBodyFatPercentageChart 
            data={chartData} 
            isAnimating={isAnimating}
            animationDuration={getAnimationDuration()}
            onAnimationComplete={onAnimationComplete}
          />
        </div>

      </div>

      {/* Animation Status */}
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          {isAnimating 
            ? `🎬 Animation in progress... (${getAnimationDuration()}ms)`
            : `⏸️ Animation ready - Click "Start Animation" to preview`
          }
        </p>
      </div>

    </div>
  )
} 