// src/app/components/health/marketing/AnimatedChartPreview.tsx
// Chart preview with animation controls for marketing content

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { getWeeklyDataForCharts, type WeeklyCheckin } from '../healthService'
import MarketingWeightTrendChart from './charts/MarketingWeightTrendChart'
import MarketingPlateauPreventionChart from './charts/MarketingPlateauPreventionChart'
import MarketingWeightProjectionChart from './charts/MarketingWeightProjectionChart'
import MarketingWaistTrendChart from './charts/MarketingWaistTrendChart'
import MarketingSleepConsistencyChart from './charts/MarketingSleepConsistencyChart'
import MarketingMorningFatBurnChart from './charts/MarketingMorningFatBurnChart'
import MarketingBodyFatPercentageChart from './charts/MarketingBodyFatPercentageChart'
import { getPatientMetrics } from '../metricsService'
import MarketingWeightTrendEChart from './echarts/MarketingWeightTrendEChart'
import MarketingWeightProjectionEChart from './echarts/MarketingWeightProjectionEChart'
import MarketingPlateauPreventionEChart from './echarts/MarketingPlateauPreventionEChart'

interface AnimatedChartPreviewProps {
  patientId: string
  animationSpeed: string
  isAnimating: boolean
  onAnimationComplete: () => void
  isRecordingMode?: boolean
  privacyMode?: boolean
  showCaptions?: boolean
  showSafeZones?: boolean
  layoutMode?: 'stack' | 'three-up'
  durationSeconds?: number
}

export default function AnimatedChartPreview({ 
  patientId, 
  animationSpeed, 
  isAnimating, 
  onAnimationComplete,
  isRecordingMode = false,
  privacyMode = true,
  showCaptions = true,
  showSafeZones = true,
  layoutMode = 'stack',
  durationSeconds = 30
}: AnimatedChartPreviewProps) {
  const [chartData, setChartData] = useState<WeeklyCheckin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metricsCaption, setMetricsCaption] = useState<string>('')
  const [currentWeek, setCurrentWeek] = useState<number>(0)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animRunningRef = useRef(false)
  const weightChartRef = useRef<any | null>(null)
  const weightRafRef = useRef<number | null>(null)
  const weightStartRef = useRef<number>(0)

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
        const safeData = data || []
        setChartData(safeData)
        // Initialize currentWeek to max when not animating
        const maxW = safeData.length > 0 ? Math.max(...safeData.map(d => d.week_number)) : 0
        if (!isAnimating) setCurrentWeek(maxW)
        // Build a simple smart caption from metrics
        try {
          const m = await getPatientMetrics(patientId)
          if (m && m.hasEnoughData) {
            const total = m.totalWeightLossPercentage !== null ? `${m.totalWeightLossPercentage.toFixed(1)}%` : '--'
            const weekly = m.weeklyWeightLossPercentage !== null ? `${m.weeklyWeightLossPercentage.toFixed(1)}%` : '--'
            setMetricsCaption(`Total Loss: ${total} • Last Week: ${weekly} • Goal: ${(m.weightChangeGoalPercent ?? 1).toFixed(2)}%/wk`)
          } else {
            setMetricsCaption('Progress will appear here as data accumulates')
          }
        } catch {
          setMetricsCaption('')
        }
      }
    } catch (err) {
      setError('Failed to load chart data')
    }

    setLoading(false)
  }
  // Parent-controlled reveal animation for all charts
  useEffect(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current)
      animTimerRef.current = null
    }
    animRunningRef.current = false

    if (!isAnimating || chartData.length === 0) {
      const maxW = chartData.length > 0 ? Math.max(...chartData.map(d => d.week_number)) : 0
      setCurrentWeek(maxW)
      return
    }

    const maxWeek = Math.max(...chartData.map(d => d.week_number))
    setCurrentWeek(0)
    animRunningRef.current = true
    // Map slider seconds to total duration; ensure min frame time
    const totalMs = Math.max(0, Math.floor(durationSeconds * 1000))
    const stepMs = Math.max(16, Math.floor((totalMs || getAnimationDuration()) / Math.max(1, maxWeek)))

    const tick = (w: number) => {
      if (!animRunningRef.current) return
      setCurrentWeek(w)
      if (w >= maxWeek) {
        animRunningRef.current = false
        onAnimationComplete()
        return
      }
      animTimerRef.current = setTimeout(() => tick(w + 1), stepMs)
    }
    // Ease-in-out timing by variable increment spacing
    // We approximate easing by varying effective week increments across time
    animTimerRef.current = setTimeout(() => tick(0), stepMs)

    return () => {
      animRunningRef.current = false
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [isAnimating, chartData, durationSeconds])

  // Smooth RAF-driven animation and axis growth for Weight Trend EChart
  useEffect(() => {
    if (weightRafRef.current) {
      cancelAnimationFrame(weightRafRef.current)
      weightRafRef.current = null
    }
    if (!isAnimating || !weightChartRef.current || chartData.length === 0) return

    const durationMs = Math.max(0, Math.floor(durationSeconds * 1000))
    const seriesPairs = chartData
      .filter(d => d.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(d => [d.week_number, d.weight as number] as [number, number])
    if (seriesPairs.length === 0) return
    const minWeek = seriesPairs[0][0]
    const maxWeek = seriesPairs[seriesPairs.length - 1][0]
    const maxIndex = seriesPairs.length - 1
    weightStartRef.current = performance.now()

    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const step = () => {
      const now = performance.now()
      const elapsed = Math.min(durationMs, now - weightStartRef.current)
      const raw = durationMs === 0 ? 1 : elapsed / durationMs
      const eased = easeInOutCubic(Math.min(1, Math.max(0, raw)))
      const headIdxFloat = maxIndex * eased
      const headFloor = Math.floor(headIdxFloat)
      const headFrac = headIdxFloat - headFloor
      const last = seriesPairs[headFloor] || seriesPairs[0]
      const next = seriesPairs[headFloor + 1] || last
      const headX = (last?.[0] ?? 0) + ((next?.[0] ?? last?.[0] ?? 0) - (last?.[0] ?? 0)) * headFrac
      const headY = (last?.[1] ?? 0) + ((next?.[1] ?? last?.[1] ?? 0) - (last?.[1] ?? 0)) * headFrac
      const revealCount = Math.max(1, Math.min(seriesPairs.length, headFloor + 1))
      const revealSeries: [number, number][] = seriesPairs.slice(0, revealCount)
      // Append interpolated head for continuous line
      if (revealSeries.length === 0 || revealSeries[revealSeries.length - 1][0] !== headX) {
        revealSeries.push([headX, headY])
      }

      // Grow axis max with head to avoid jolts
      const axisPad = Math.max(0.5, (maxWeek - minWeek) * 0.05)
      const xMax = Math.max(minWeek + 1, headX + axisPad)

      try {
        weightChartRef.current.setOption({
          xAxis: { max: xMax, min: minWeek },
          series: [
            { id: 'revealWeight', data: revealSeries },
            { id: 'headWeight', data: [[headX, headY]] }
          ]
        }, false, true)
      } catch {}

      if (elapsed >= durationMs) return
      weightRafRef.current = requestAnimationFrame(step)
    }

    weightRafRef.current = requestAnimationFrame(step)

    return () => {
      if (weightRafRef.current) cancelAnimationFrame(weightRafRef.current)
    }
  }, [isAnimating, chartData, durationSeconds])

  // Data visible at the current frame
  const visibleData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [] as WeeklyCheckin[]
    return chartData.filter(d => typeof currentWeek !== 'number' ? true : d.week_number <= currentWeek)
  }, [chartData, currentWeek])


  // Calculate animation duration based on speed
  const getAnimationDuration = () => Math.max(0, Math.floor(durationSeconds * 1000))

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

  // 9:16 frame style helper
  const frameClass = 'relative mx-auto bg-white rounded-lg overflow-hidden border border-gray-200'
  const frameRatioBox = (
    <div className={frameClass} style={{ width: '100%', aspectRatio: '9 / 16' }}>
      {/* Safe zone overlays for IG UI (optional) */}
      {showSafeZones && (
        <>
          <div className="absolute top-0 left-0 right-0" style={{ height: '8%' }} />
          <div className="absolute bottom-0 left-0 right-0" style={{ height: '10%' }} />
        </>
      )}

      {/* Scrollable content area mimicking client view, or 3-up grid */}
      <div className={`absolute inset-0 ${layoutMode === 'stack' ? 'overflow-y-auto' : ''} p-3`}>
        {layoutMode === 'three-up' ? (
          <div className="grid grid-rows-3 gap-3 h-full">
            <div className="border border-gray-200 rounded p-2">
              <div className="w-full h-full" style={{ height: '100%' }}>
                <MarketingWeightTrendEChart
                  data={chartData}
                  hideTooltips={isRecordingMode}
                  hideTitles={isRecordingMode}
                  onReady={(inst) => { weightChartRef.current = inst }}
                />
              </div>
            </div>
            <div className="border border-gray-200 rounded p-2">
              <div className="w-full h-full" style={{ height: '100%' }}>
                <MarketingWeightProjectionEChart data={visibleData} hideTooltips={isRecordingMode} hideTitles={isRecordingMode} />
              </div>
            </div>
            <div className="border border-gray-200 rounded p-2">
              <div className="w-full h-full" style={{ height: '100%' }}>
                <MarketingPlateauPreventionEChart data={visibleData} hideTooltips={isRecordingMode} hideTitles={isRecordingMode} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <div className="w-full" style={{ height: 280 }}>
                <MarketingWeightTrendEChart
                  data={chartData}
                  hideTooltips={isRecordingMode}
                  hideTitles={isRecordingMode}
                  onReady={(inst) => { weightChartRef.current = inst }}
                />
              </div>
            </div>
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <div className="w-full" style={{ height: 280 }}>
                <MarketingPlateauPreventionEChart data={visibleData} hideTooltips={isRecordingMode} hideTitles={isRecordingMode} />
              </div>
            </div>
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <div className="w-full" style={{ height: 280 }}>
                <MarketingWeightProjectionEChart data={visibleData} hideTooltips={isRecordingMode} hideTitles={isRecordingMode} />
              </div>
            </div>
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <MarketingWaistTrendChart 
                data={visibleData} 
                isAnimating={false}
                animationDuration={getAnimationDuration()}
                onAnimationComplete={onAnimationComplete}
                hideTooltips={isRecordingMode}
                hideTitles={isRecordingMode}
              />
            </div>
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <MarketingSleepConsistencyChart 
                data={visibleData} 
                isAnimating={false}
                animationDuration={getAnimationDuration()}
                onAnimationComplete={onAnimationComplete}
                hideTooltips={isRecordingMode}
                hideTitles={isRecordingMode}
              />
            </div>
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <MarketingMorningFatBurnChart 
                data={visibleData} 
                isAnimating={false}
                animationDuration={getAnimationDuration()}
                onAnimationComplete={onAnimationComplete}
                hideTooltips={isRecordingMode}
                hideTitles={isRecordingMode}
              />
            </div>
            <div className={`rounded ${isRecordingMode ? '' : 'border border-gray-200'} p-2`}>
              <MarketingBodyFatPercentageChart 
                data={visibleData} 
                isAnimating={false}
                animationDuration={getAnimationDuration()}
                onAnimationComplete={onAnimationComplete}
                hideTooltips={isRecordingMode}
                hideTitles={isRecordingMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* Smart Caption (bottom overlay) */}
      {showCaptions && metricsCaption && (
        <div className="absolute left-0 right-0 bottom-2 flex justify-center">
          <div className="px-3 py-1 rounded-full text-xs font-medium shadow-md"
               style={{ background: 'rgba(17,24,39,0.8)', color: 'white' }}>
            {metricsCaption}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      
      {/* Preview Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900">
            📊 Chart Preview
          </h4>
          <p className="text-sm text-gray-600">
            {chartData.length} weeks of data • Scene: {durationSeconds}s
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

      {/* 9:16 Canvas with content */}
      {frameRatioBox}

      {/* Animation Status */}
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          {isAnimating 
            ? `🎬 Animation in progress... (${durationSeconds}s)`
            : `⏸️ Animation ready - Click "Start Animation" to preview`
          }
        </p>
      </div>

    </div>
  )
} 