'use client'

import { useEffect, useState } from 'react'
import type { SnapshotJson } from '@/app/components/health/marketing/snapshotTypes'
import dynamic from 'next/dynamic'
const MarketingWeightTrendEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingWeightTrendEChart'), { ssr: false })
const MarketingWeightProjectionEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingWeightProjectionEChart'), { ssr: false })
const ClientPlateauPreventionChart = dynamic(() => import('@/app/components/health/charts/PlateauPreventionChart'), { ssr: false })
const MarketingWaistTrendChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingWaistTrendChart'), { ssr: false })
const MarketingSleepConsistencyChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingSleepConsistencyChart'), { ssr: false })
const MarketingMorningFatBurnChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingMorningFatBurnChart'), { ssr: false })
const MarketingBodyFatPercentageChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingBodyFatPercentageChart'), { ssr: false })

type UnitSystem = 'imperial' | 'metric'

export default function AliasStoryClient({ snapshot, shareSlug, pageType = 'alias' }: { snapshot: SnapshotJson; shareSlug?: string; pageType?: 'alias' | 'version' }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')

  const m = snapshot.metrics
  const meta = snapshot.meta
  const slug = (shareSlug as any) || (snapshot?.meta as any)?.slug
  const reportClick = (ctaId: string) => {
    try {
      const s = (window as any).__marketingSlug || slug
      if (s) {
        fetch(`/api/marketing/shares/${encodeURIComponent(s)}/click`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ctaId, pageType })
        })
      }
    } catch {}
  }

  return (
    <main className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="max-w-md mx-auto p-4 text-center">
        <div className="text-sm text-gray-500">{meta.watermarkText || 'The Fittest You'}</div>
        <h1 className="text-xl font-bold mt-1">Become the Fittest Version of Yourself.</h1>
        <div className="mt-1 text-gray-700">{meta.patientLabel}</div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button
            className={`px-3 py-1 rounded border ${unitSystem === 'imperial' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            onClick={() => setUnitSystem('imperial')}
          >
            Imperial
          </button>
          <button
            className={`px-3 py-1 rounded border ${unitSystem === 'metric' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            onClick={() => setUnitSystem('metric')}
          >
            Metric
          </button>
        </div>
      </header>

      {/* Hero media: below unit toggle; two-column layout (left + optional right)
          Priority: prefer images (after/before) over loop video */}
      {(() => {
        const media = (snapshot as any)?.media || {}
        const loop = media?.loopVideoUrl as string | undefined
        const beforeUrl = media?.beforePhotoUrl as string | undefined
        const afterUrl = media?.afterPhotoUrl as string | undefined
        const firstFit3d = Array.isArray(media?.fit3d?.images) && media.fit3d.images.length > 0
          ? (media.fit3d.images[0] as string)
          : undefined

        const isMp4 = (u?: string) => {
          if (!u) return false
          try { return /\.mp4($|\?)/i.test(new URL(u).pathname) } catch { return false }
        }

        // Prefer images first, then loop
        const primary = afterUrl || beforeUrl || loop || null
        if (!primary) return null

        const secondary = (() => {
          // Option A: only show the other hero media or loop; ignore Fit3D
          if ((primary === afterUrl || primary === beforeUrl) && loop) return loop
          if (primary === afterUrl && beforeUrl) return beforeUrl
          if (primary === beforeUrl && afterUrl) return afterUrl
          return null
        })()

        const render = (u: string) => (
          <div className="rounded border overflow-hidden">
            {isMp4(u) ? (
              <video src={u} muted loop playsInline autoPlay controls={false} className="w-full h-auto" />
            ) : (
              <img src={u} alt="Hero" className="w-full h-auto" />
            )}
          </div>
        )

        return (
          <section className="max-w-md mx-auto px-4">
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>{render(primary)}</div>
              <div>{secondary ? render(secondary as string) : null}</div>
            </div>
          </section>
        )
      })()}

      {/* Compliance cards */}
      <section className="max-w-md mx-auto p-4 grid grid-cols-2 gap-3">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Loss %</div>
          <div className="text-lg font-semibold">{m.totalLossPct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Weekly Loss %</div>
          <div className="text-lg font-semibold">{m.weeklyLossPct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Avg Nutrition %</div>
          <div className="text-lg font-semibold">{m.avgNutritionCompliancePct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Avg Exercise Days</div>
          <div className="text-lg font-semibold">{m.avgPurposefulExerciseDays ?? '—'}</div>
        </div>
      </section>

      {/* Charts */}
      <section id="charts" className="max-w-md mx-auto p-4">
        <div className="rounded border p-2">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">⚖️ Weight Trend Analysis</h3>
            <p className="text-sm text-gray-600">Basic progress tracking with trend line for overall direction. Shows your actual weekly weights with a trend line indicating general progress.</p>
          </div>
          <div className="w-full" style={{ height: 300 }}>
            <MarketingWeightTrendEChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
              hideTitles={false}
              unitSystem={unitSystem}
            />
          </div>
          <div className="mt-3 text-xs text-gray-500">
            <p>• Track weekly progress</p>
            <p>• Dark black trend line shows overall direction</p>
            <p>• Weekly fluctuations are normal - focus on trendline should be prioritized</p>
          </div>
        </div>

        <div className="rounded border p-2 mt-4">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">📊 Weight Loss Trend vs. Projections</h3>
            <p className="text-sm text-gray-600">Compares actual weight loss against 4 different fat loss projection rates. Helps identify if progress is on track with expectations.</p>
          </div>
          <div className="w-full" style={{ height: 300 }}>
            <MarketingWeightProjectionEChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
              hideTitles={true}
              unitSystem={unitSystem}
            />
          </div>
          {/* Client-style legend below the chart */}
          <div className="mt-2 text-xs text-gray-700 flex flex-wrap gap-4">
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-red-500" />Actual Weight ({unitSystem === 'metric' ? 'kg' : 'lbs'})</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-emerald-500" />0.5% loss/wk</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-blue-600" />1.0% loss/wk</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-violet-600" />1.5% loss/wk</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-amber-500" />2.0% loss/wk</div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            <p>• Red line shows actual progress (irregular pattern expected)</p>
            <p>• Dark black trend line shows actual weight trajectory</p>
            <p>• Dotted lines show theoretical projections extending to match your current progress</p>
            <p>• Projections help identify if progress is on track with expectations</p>
          </div>
        </div>

        <div className="rounded border p-2 mt-4">
          <div className="w-full">
            <ClientPlateauPreventionChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
            />
          </div>
        </div>
      </section>

      {/* Inline CTA after Charts */}
      <section className="max-w-md mx-auto px-4">
        <div className="inline-cta-sentinel mt-2">
          <a
            href="#cta"
            className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium"
            onClick={() => reportClick('after_charts')}
          >
            Book a consult
          </a>
        </div>
      </section>

      {/* Optional charts (collapsed) */}
      <section className="max-w-md mx-auto p-4">
        <details className="rounded border">
          <summary className="p-2 cursor-pointer select-none">Waist Trend</summary>
          <div className="p-2">
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">📏 Waist Trend Analysis</h3>
              <p className="text-sm text-gray-600">Tracks waist circumference changes over time. Often more reliable than weight for measuring body composition changes and fat loss progress.</p>
            </div>
            <MarketingWaistTrendChart
              data={(snapshot.derived.waistTrend || []).map(([week, value]) => ({ date: '', week_number: week, waist: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-500">
              <p>• Often more accurate than weight for fat loss tracking</p>
              <p>• Dark black trend line shows overall waist measurement change direction</p>
              <p>• Always measure at the horizontal level of your belly button with your stomoch 100% relaxed.</p>
            </div>
          </div>
        </details>

        <details className="rounded border mt-4">
          <summary className="p-2 cursor-pointer select-none">Sleep Consistency</summary>
          <div className="p-2">
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">😴 Sleep Consistency & Recovery</h3>
              <p className="text-sm text-gray-600">Weekly sleep quality scores from biometric analysis (added by Dr. Nick)</p>
            </div>
            <MarketingSleepConsistencyChart
              data={(snapshot.derived.sleepTrend || []).map(([week, value]) => ({ date: '', week_number: week, sleep_consistency_score: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-500">
              <p>• Data sourced from biometric analysis by Dr. Nick</p>
              <p>• Dark black trend line shows overall sleep consistency direction</p>
              <p>• Higher scores indicate better sleep consistency and recovery</p>
              <p>• Sleep consistency directly impacts weight loss and overall progress</p>
            </div>
          </div>
        </details>

        <details className="rounded border mt-4">
          <summary className="p-2 cursor-pointer select-none">Morning Fat Burn %</summary>
          <div className="p-2">
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">🔥 Morning Fat Oxidation %</h3>
              <p className="text-sm text-gray-600">Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes, and that metabolic adaptation is progressing accordingly.</p>
            </div>
            <MarketingMorningFatBurnChart
              data={(snapshot.derived.morningFatBurnTrend || []).map(([week, value]) => ({ date: '', week_number: week, morning_fat_burn_percent: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-500">
              <p>• Measured weekly through metabolic analysis</p>
              <p>• Higher percentages over time indicate your body is responding to Dr. Nick's program changes</p>
              <p>• Shows how well your body burns fat in a fasted state</p>
            </div>
          </div>
        </details>

        <details className="rounded border mt-4">
          <summary className="p-2 cursor-pointer select-none">Body Fat %</summary>
          <div className="p-2">
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">📊 Body Fat Percentage</h3>
              <p className="text-sm text-gray-600">Your body fat percentage tracks changes in body composition beyond just weight. This precise measurement shows how much of your weight loss comes from fat versus muscle, helping optimize your program for the best results.</p>
            </div>
            <MarketingBodyFatPercentageChart
              data={(snapshot.derived.bodyFatTrend || []).map(([week, value]) => ({ date: '', week_number: week, body_fat_percentage: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-500">
              <p>• Measured using the most precise testing methodology Dr. Nick has determined available in your situation</p>
              <p>• Scheduled periodically based on your progress milestones</p>
              <p>• More accurate than weight alone for tracking fat loss</p>
            </div>
          </div>
        </details>
      </section>

      {/* Photos placeholder */}
      <section id="photos" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Photos section coming soon</div>
      </section>

      {/* Inline CTA after Photos (Hero) */}
      <section className="max-w-md mx-auto px-4">
        <div id="cta" className="inline-cta-sentinel mt-4 mb-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_photos')}>Book a consult</a>
        </div>
      </section>

      {/* Fit3D placeholder */}
      <section id="fit3d" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Fit3D section coming soon</div>
      </section>

      {/* Testing placeholder */}
      <section id="testing" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testing (DocSend) section coming soon</div>
      </section>

      {/* Inline CTA after Testing */}
      <section className="max-w-md mx-auto px-4">
        <div className="inline-cta-sentinel mt-4 mb-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_testing')}>Book a consult</a>
        </div>
      </section>

      {/* Testimonial placeholder */}
      <section id="testimonial" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testimonial section coming soon</div>
      </section>

      {/* Inline CTA above footer (after Testimonials) */}
      <section className="max-w-md mx-auto px-4">
        <div className="inline-cta-sentinel mt-4 mb-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_testimonials')}>Book a consult</a>
        </div>
      </section>

      {/* No global fixed CTA while editing — using per-section CTAs above */}
    </main>
  )
}


