'use client'

import { useEffect, useState } from 'react'
import type { SnapshotJson } from '@/app/components/health/marketing/snapshotTypes'
import { CTA_LABEL, CALENDLY_URL, TAGLINE } from '@/app/components/health/marketing/marketingConfig'
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
  const ctaLabel = (meta as any)?.ctaLabel || 'Book a consult'
  const displayLabel = (meta as any)?.displayNameOverride || meta.patientLabel
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
        <div className="text-sm text-gray-700">{TAGLINE}</div>
        <h1 className="text-xl font-bold mt-1">Become the Fittest Version of Yourself.</h1>
        <div className="mt-1 text-gray-700">{displayLabel}</div>
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
          Layout rules:
          - If both images exist: left=Before, right=After
          - If only After: right=After; left=Loop (if present) else empty
          - If only Before: left=Before; right=Loop (if present) else empty
          - If neither image: left=Loop (if present)
          Fit3D is ignored for hero. */}
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

        // Decide left/right explicitly
        let left: string | null = null
        let right: string | null = null
        if (beforeUrl && afterUrl) {
          left = beforeUrl
          right = afterUrl
        } else if (afterUrl && !beforeUrl) {
          right = afterUrl
          left = loop || null
        } else if (beforeUrl && !afterUrl) {
          left = beforeUrl
          right = loop || null
        } else if (!beforeUrl && !afterUrl) {
          left = loop || null
        }

        if (!left && !right) return null

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
              <div>{left ? render(left) : null}</div>
              <div>{right ? render(right) : null}</div>
            </div>
          </section>
        )
      })()}

      {/* Compliance cards */}
      <section className="max-w-md mx-auto p-4 grid grid-cols-2 gap-3">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-700">Total Loss %</div>
          <div className="text-lg font-semibold">{m.totalLossPct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-700">Weekly Loss %</div>
          <div className="text-lg font-semibold">{m.weeklyLossPct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-700">Avg Nutrition %</div>
          <div className="text-lg font-semibold">{m.avgNutritionCompliancePct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-700">Avg Exercise Days</div>
          <div className="text-lg font-semibold">{m.avgPurposefulExerciseDays ?? '—'}</div>
        </div>
      </section>

      {/* Charts */}
      <section id="charts" className="max-w-md mx-auto p-4">
        <div className="rounded border p-2">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">⚖️ Weight Trend Analysis</h3>
            <p className="text-sm text-gray-700">Basic progress tracking with trend line for overall direction. Shows your actual weekly weights with a trend line indicating general progress.</p>
          </div>
          <div className="w-full" style={{ height: 300 }}>
            <MarketingWeightTrendEChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
              hideTitles={false}
              unitSystem={unitSystem}
            />
          </div>
          <div className="mt-3 text-xs text-gray-700">
            <p>• Track weekly progress</p>
            <p>• Dark black trend line shows overall direction</p>
            <p>• Weekly fluctuations are normal - focus on trendline should be prioritized</p>
          </div>
        </div>

        <div className="rounded border p-2 mt-4">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">📊 Weight Loss Trend vs. Projections</h3>
            <p className="text-sm text-gray-700">Compares actual weight loss against 4 different fat loss projection rates. Helps identify if progress is on track with expectations.</p>
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
          <div className="mt-3 text-xs text-gray-700">
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
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_charts')}>{CTA_LABEL}</a>
        </div>
      </section>

      {/* Optional charts (collapsed) */}
      <section className="max-w-md mx-auto p-4">
        <details className="rounded border">
          <summary className="p-2 cursor-pointer select-none">Waist Trend</summary>
          <div className="p-2">
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">📏 Waist Trend Analysis</h3>
              <p className="text-sm text-gray-700">Tracks waist circumference changes over time. Often more reliable than weight for measuring body composition changes and fat loss progress.</p>
            </div>
            <MarketingWaistTrendChart
              data={(snapshot.derived.waistTrend || []).map(([week, value]) => ({ date: '', week_number: week, waist: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-700">
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
              <p className="text-sm text-gray-700">Weekly sleep quality scores from biometric analysis (added by Dr. Nick)</p>
            </div>
            <MarketingSleepConsistencyChart
              data={(snapshot.derived.sleepTrend || []).map(([week, value]) => ({ date: '', week_number: week, sleep_consistency_score: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-700">
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
              <p className="text-sm text-gray-700">Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes, and that metabolic adaptation is progressing accordingly.</p>
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
              <p className="text-sm text-gray-700">Your body fat percentage tracks changes in body composition beyond just weight. This precise measurement shows how much of your weight loss comes from fat versus muscle, helping optimize your program for the best results.</p>
            </div>
            <MarketingBodyFatPercentageChart
              data={(snapshot.derived.bodyFatTrend || []).map(([week, value]) => ({ date: '', week_number: week, body_fat_percentage: value })) as any}
              isAnimating={false}
              animationDuration={0}
              onAnimationComplete={() => {}}
              hideTitles={true}
            />
            <div className="mt-3 text-xs text-gray-700">
              <p>• Measured using the most precise testing methodology Dr. Nick has determined available in your situation</p>
              <p>• Scheduled periodically based on your progress milestones</p>
              <p>• More accurate than weight alone for tracking fat loss</p>
            </div>
          </div>
        </details>
      </section>

      {/* Fit3D section */}
      <section id="fit3d" className="max-w-md mx-auto p-4">
        <details className="rounded border">
          <summary className="p-2 cursor-pointer select-none">Fit3D</summary>
          <div className="p-2">
            <div className="mb-2 text-sm text-gray-700">3D body scans highlighting body composition changes.</div>
            <div className="grid grid-cols-2 gap-2">
              {(((snapshot as any)?.media?.fit3d?.images || []) as string[]).slice(0,2).map((u, i) => (
                <div key={i} className="rounded border overflow-hidden">
                  {/\.mp4($|\?)/i.test(u) ? (
                    <video src={u} muted playsInline controls className="w-full h-auto" />
                  ) : (
                    <img src={u} alt={`Fit3D ${i+1}`} className="w-full h-auto" />
                  )}
                </div>
              ))}
            </div>
            {(snapshot as any)?.media?.fit3d?.youtubeId ? (
              <div className="mt-3">
                <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${(snapshot as any).media.fit3d.youtubeId}`} title="Fit3D" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              </div>
            ) : null}
          </div>
        </details>
      </section>

      {/* Inline CTA after Photos (Hero) */}
      <section className="max-w-md mx-auto px-4">
        <div id="cta" className="inline-cta-sentinel mt-4 mb-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_photos')}>{CTA_LABEL}</a>
        </div>
      </section>

      

      {/* Testing placeholder */}
      <section id="testing" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testing (DocSend) section coming soon</div>
      </section>

      {/* Inline CTA after Testing */}
      <section className="max-w-md mx-auto px-4">
        <div className="inline-cta-sentinel mt-4 mb-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_testing')}>{CTA_LABEL}</a>
        </div>
      </section>

      {/* Testimonial placeholder */}
      <section id="testimonial" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testimonial section coming soon</div>
      </section>

      {/* Inline CTA above footer (after Testimonials) */}
      <section className="max-w-md mx-auto px-4">
        <div className="inline-cta-sentinel mt-4 mb-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_testimonials')}>{CTA_LABEL}</a>
        </div>
      </section>

      {/* Calendly Section */}
      <section id="cta" className="max-w-md mx-auto p-4">
        <div className="rounded border p-2">
          <div className="text-sm text-gray-700 mb-2">Schedule a consult</div>
          <div className="calendly-inline-widget" data-url={CALENDLY_URL} style={{ minWidth: 320, height: 700 }} />
          <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async />
        </div>
      </section>

      {/* No global fixed CTA while editing — using per-section CTAs above */}
    </main>
  )
}


