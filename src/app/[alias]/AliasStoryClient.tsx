'use client'

import { useEffect, useState } from 'react'
import type { SnapshotJson } from '@/app/components/health/marketing/snapshotTypes'
import { CTA_LABEL, CALENDLY_URL, TAGLINE, DOCSEND_URL } from '@/app/components/health/marketing/marketingConfig'
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
  const chartsEnabled = {
    weightTrend: true,
    projection: true,
    plateauWeight: true,
    waistTrend: false,
    plateauWaist: false,
    nutritionCompliancePct: false,
    sleepTrend: false,
    morningFatBurnTrend: false,
    bodyFatTrend: false,
    ...(meta as any)?.chartsEnabled
  } as Record<string, boolean>
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
      {/* Brand Bar */}
      <div className="w-full bg-blue-600 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4 py-3 text-center">
          <div className="font-semibold tracking-wide">{TAGLINE}</div>
        </div>
      </div>
      {/* Header */}
      <header className="max-w-md mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{displayLabel}</h1>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button
            className={`px-3 py-1 rounded-md border ${unitSystem === 'imperial' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
            onClick={() => setUnitSystem('imperial')}
          >
            Imperial
          </button>
          <button
            className={`px-3 py-1 rounded-md border ${unitSystem === 'metric' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
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
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {isMp4(u) ? (
              <video src={u} muted loop playsInline autoPlay controls={false} className="w-full h-auto" />
            ) : (
              <img src={u} alt="Hero" className="w-full h-auto" />
            )}
          </div>
        )

        // Result capsule data
        const weeksMax = Array.isArray((snapshot as any)?.weeksRaw) && (snapshot as any).weeksRaw.length > 0
          ? Math.max(...((snapshot as any).weeksRaw as any[]).map((w: any) => Number(w?.week_number || 0)))
          : 0
        const dwCaps = (snapshot.meta as any)?.displayWeeks
        const weeksShown = typeof dwCaps?.effectiveEnd === 'number' ? dwCaps.effectiveEnd : weeksMax
        const totalLoss = typeof m.totalLossPct === 'number' ? m.totalLossPct : null

        return (
          <section className="max-w-md mx-auto px-4 relative">
            {totalLoss !== null && weeksShown > 0 ? (
              <div className="absolute z-10 left-3 -top-3">
                <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">
                  {totalLoss}% total loss • {weeksShown} weeks
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>{left ? render(left) : null}</div>
              <div>{right ? render(right) : null}</div>
            </div>
          </section>
        )
      })()}

      {/* Compliance cards */}
      <section className="max-w-md mx-auto p-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Total Loss %</div>
          <div className="text-xl font-bold text-gray-900">{m.totalLossPct ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Weekly Loss %</div>
          <div className="text-xl font-bold text-gray-900">{m.weeklyLossPct ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Avg Nutrition %</div>
          <div className="text-xl font-bold text-gray-900">{m.avgNutritionCompliancePct ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Avg Exercise Days</div>
          <div className="text-xl font-bold text-gray-900">{m.avgPurposefulExerciseDays ?? '—'}</div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-md mx-auto px-4">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm bg-white">
          <div className="text-gray-900 text-base font-semibold mb-1">What clients say</div>
          <p className="italic text-gray-700 text-sm">“I tried everything before this. Dr. Nick’s weekly adjustments finally made the scale move without killing my energy. I feel lighter, stronger, and clear on what to do next.”</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
            <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">A</div>
            <div>Areg</div>
          </div>
        </div>
      </section>

      {/* What you’ll get */}
      <section className="max-w-md mx-auto px-4 mt-3">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm bg-white">
          <div className="text-gray-900 text-base font-semibold mb-2">What you’ll get</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div className="flex items-start gap-2 text-gray-700"><span>🗓️</span><span>Weekly expert adjustments</span></div>
            <div className="flex items-start gap-2 text-gray-700"><span>🧬</span><span>Data‑driven nutrition</span></div>
            <div className="flex items-start gap-2 text-gray-700"><span>✅</span><span>Accountability that sticks</span></div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section id="charts" className="max-w-md mx-auto p-4">
        {chartsEnabled.weightTrend && Array.isArray(snapshot.derived.weightTrend) && (snapshot.derived.weightTrend as any[]).length > 0 && (
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">⚖️ Weight Trend Analysis</h3>
            <p className="text-sm text-gray-700">Track weekly weight with a clear trend line indicating overall direction.</p>
          </div>
          <div className="w-full" style={{ height: 300 }}>
            <MarketingWeightTrendEChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
              hideTitles={false}
              unitSystem={unitSystem}
            />
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <p>• Weekly fluctuations are normal; follow the trend.</p>
          </div>
        </div>
        )}

        {chartsEnabled.projection && Array.isArray(snapshot.derived.weightTrend) && (snapshot.derived.weightTrend as any[]).length > 0 && (
        <div className="rounded-lg border border-gray-200 p-3 mt-4 shadow-sm">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">📊 Weight Loss Trend vs. Projections</h3>
            <p className="text-sm text-gray-700">Compare actual progress against four projection rates.</p>
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
          <div className="mt-3 text-xs text-gray-600">
            <p>• Actual vs projected loss rates at a glance.</p>
          </div>
        </div>
        )}

        {chartsEnabled.plateauWeight && Array.isArray(snapshot.derived.weightTrend) && (snapshot.derived.weightTrend as any[]).length > 0 && (
        <div className="rounded-lg border border-gray-200 p-3 mt-4 shadow-sm">
          <div className="w-full">
            <ClientPlateauPreventionChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
            />
          </div>
        </div>
        )}
      </section>

      {/* Inline CTA after Charts */}
      <section className="max-w-md mx-auto px-4">
        {(() => {
          const dw = (snapshot.meta as any)?.displayWeeks
          if (dw && typeof dw.start === 'number' && typeof dw.end === 'number' && typeof dw.effectiveEnd === 'number' && dw.effectiveEnd < dw.end) {
            return (
              <div className="text-xs text-gray-600 mb-2">
                Showing weeks {dw.start}–{dw.effectiveEnd} (requested {dw.start}–{dw.end})
              </div>
            )
          }
          return null
        })()}
        <div className="inline-cta-sentinel mt-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium" onClick={() => reportClick('after_charts')}>{CTA_LABEL}</a>
        </div>
      </section>

      {/* Optional charts (collapsed) */}
      <section className="max-w-md mx-auto p-4">
        {chartsEnabled.waistTrend && Array.isArray(snapshot.derived.waistTrend) && (snapshot.derived.waistTrend as any[]).length > 0 && (
        <details className="rounded-lg border border-gray-200 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">Waist Trend</summary>
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
        )}

        {chartsEnabled.sleepTrend && Array.isArray(snapshot.derived.sleepTrend) && (snapshot.derived.sleepTrend as any[]).length > 0 && (
        <details className="rounded-lg border border-gray-200 mt-4 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">Sleep Consistency</summary>
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
        )}

        {chartsEnabled.morningFatBurnTrend && Array.isArray(snapshot.derived.morningFatBurnTrend) && (snapshot.derived.morningFatBurnTrend as any[]).length > 0 && (
        <details className="rounded-lg border border-gray-200 mt-4 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">Morning Fat Burn %</summary>
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
        )}

        {chartsEnabled.bodyFatTrend && Array.isArray(snapshot.derived.bodyFatTrend) && (snapshot.derived.bodyFatTrend as any[]).length > 0 && (
        <details className="rounded-lg border border-gray-200 mt-4 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">Body Fat %</summary>
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
        )}
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

      {/* Inline CTA after Photos (Hero) removed to keep focus */}

      

      {/* Testing (DocSend) */}
      <section id="testing" className="max-w-md mx-auto p-4">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-sm text-gray-900 mb-2">Metabolic/Cardio Testing</div>
          <div className="w-full">
            <iframe src={(snapshot as any)?.media?.testing?.docsendUrl || DOCSEND_URL} allow="fullscreen" width="640" height="480" className="w-full" />
          </div>
        </div>
      </section>

      {/* Extra CTAs removed to keep two key placements */}

      {/* Testimonial placeholder */}
      <section id="testimonial" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testimonial section coming soon</div>
      </section>

      {/* Extra CTAs removed */}

      {/* Calendly Section */}
      <section id="cta" className="max-w-md mx-auto p-4">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-sm text-gray-900 mb-2">Schedule a consult</div>
          <div className="calendly-inline-widget" data-url={CALENDLY_URL} style={{ minWidth: 320, height: 700 }} />
          <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async />
        </div>
      </section>

      {/* No global fixed CTA while editing — using per-section CTAs above */}
    </main>
  )
}


