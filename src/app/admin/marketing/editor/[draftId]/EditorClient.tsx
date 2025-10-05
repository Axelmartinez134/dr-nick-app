'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/app/components/auth/AuthContext'
import PreviewClient from './PreviewClient'

export default function EditorClient({ draftId, initialDraft }: { draftId: string; initialDraft: any }) {
  const [draft, setDraft] = useState<any>(initialDraft?.draft_json || initialDraft)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any | null>(null)
  const [fullAvailableMaxWeek, setFullAvailableMaxWeek] = useState<number>(0)
  const initializedRangeRef = useRef<boolean>(false)
  const fullMaxSetRef = useRef<boolean>(false)
  const [publishing, setPublishing] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishSteps, setPublishSteps] = useState<Array<{ id: string; label: string; status: 'pending' | 'in_progress' | 'done' | 'error' }>>([])
  const [tracksBP, setTracksBP] = useState<boolean>(false)

  // Debounced autosave
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setSaving(true)
        setSaveError(null)
        await fetch(`/api/marketing/drafts/${encodeURIComponent(draftId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft_json: draft })
        })
        setSaving(false)
        // Refresh preview
        const res = await fetch(`/api/marketing/drafts/${encodeURIComponent(draftId)}/preview`, { cache: 'no-store' })
        if (res.ok) setPreview(await res.json())
      } catch (e: any) {
        setSaving(false)
        setSaveError(e?.message || 'Save failed')
      }
    }, 700)
    return () => clearTimeout(t)
  }, [draftId, draft])

  // Track available max week from preview and initialize range to [1..max]
  useEffect(() => {
    if (preview && Array.isArray(preview.weeksRaw)) {
      const fromMeta = Number((preview?.meta?.displayWeeks?.availableMax) || 0)
      const maxW = fromMeta > 0
        ? fromMeta
        : preview.weeksRaw.reduce((m: number, w: any) => Math.max(m, Number(w?.week_number || 0)), 0)
      if (!fullMaxSetRef.current) {
        setFullAvailableMaxWeek(maxW)
        fullMaxSetRef.current = true
      }
      if (!initializedRangeRef.current && maxW > 0) {
        // Initialize to full range if not already set
        if (!draft?.meta?.displayWeeks || typeof draft.meta.displayWeeks.end !== 'number') {
          setMeta({ displayWeeks: { start: 1, end: maxW } })
        }
        initializedRangeRef.current = true
      }
    }
  }, [preview])

  const setMedia = (patch: any) => setDraft((d: any) => ({ ...d, media: { ...(d?.media || {}), ...patch } }))
  const setMeta = (patch: any) => setDraft((d: any) => ({ ...d, meta: { ...(d?.meta || {}), ...patch } }))

  // Load BP tracking flag to conditionally show BP toggles
  useEffect(() => {
    (async () => {
      try {
        const pid = (initialDraft as any)?.patient_id
        if (!pid) return
        const { data, error } = await supabase
          .from('profiles')
          .select('track_blood_pressure')
          .eq('id', pid)
          .single()
        if (!error) setTracksBP(Boolean(data?.track_blood_pressure))
      } catch {}
    })()
  }, [initialDraft])

  function beginPublishUI() {
    setPublishOpen(true)
    setPublishError(null)
    setPublishSteps([
      { id: 'validate', label: 'Validate', status: 'in_progress' },
      { id: 'pin', label: 'Pin media', status: 'pending' },
      { id: 'build', label: 'Build snapshot', status: 'pending' },
      { id: 'create', label: 'Create share', status: 'pending' },
      { id: 'done', label: 'Done', status: 'pending' }
    ])
    setTimeout(() => setPublishSteps((s) => s.map((x) => x.id === 'validate' ? { ...x, status: 'done' } : x)), 150)
  }

  function setStep(id: string, status: 'pending' | 'in_progress' | 'done' | 'error') {
    setPublishSteps((s) => s.map((x) => x.id === id ? { ...x, status } : x))
  }

  async function upload(kind: 'before' | 'after' | 'loop' | 'fit3d', file: File, index = 0) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    fd.append('index', String(index))
    const res = await fetch(`/api/marketing/drafts/${encodeURIComponent(draftId)}/upload`, { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Upload failed')
    return json.url as string
  }

  const patientAlias = `${initialDraft?.alias ? `/${initialDraft.alias}` : ''}`

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-6xl mx-auto p-3 flex items-center justify-between">
          <div className="text-sm text-gray-900">
            <span className="font-medium">Edit Draft</span> {patientAlias}
          </div>
          <div className="text-xs">
            {saving ? <span className="text-gray-900">Saving…</span> : saveError ? <span className="text-red-600">Save failed — Retry</span> : <span className="text-green-700">Saved</span>}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Left: Editor panels */}
        <div className="space-y-6">
          {/* Identity */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Identity</h3>
            <div className="flex gap-3 items-center text-sm text-gray-900">
              <label className="flex items-center gap-2"><input type="radio" name="displayNameMode" checked={(draft?.meta?.displayNameMode || 'first_name') === 'first_name'} onChange={() => setMeta({ displayNameMode: 'first_name', displayNameOverride: null })} /> First name</label>
              <label className="flex items-center gap-2"><input type="radio" name="displayNameMode" checked={(draft?.meta?.displayNameMode || 'first_name') === 'anonymous'} onChange={() => setMeta({ displayNameMode: 'anonymous' })} /> Anonymous</label>
            </div>
            {((draft?.meta?.displayNameMode || 'first_name') === 'anonymous') && (
              <>
                <label className="text-sm text-gray-900 block mt-3 mb-1">Custom label override</label>
                <input className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-700" value={draft?.meta?.displayNameOverride || ''} onChange={(e) => setMeta({ displayNameOverride: e.target.value })} placeholder="Custom label (optional)" />
              </>
            )}
          </section>

          {/* Hero before/after */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Hero — Before / After</h3>
            <div className="grid grid-cols-2 gap-3">
              {['before','after'].map((slot, i) => {
                const key = slot === 'before' ? 'beforePhotoUrl' : 'afterPhotoUrl'
                const val = draft?.media?.[key] || null
                return (
                  <div key={slot} className="border rounded p-3">
                    <div className="text-xs text-gray-900 mb-2">{slot === 'before' ? 'Before' : 'After'}</div>
                    {val ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {/\.mp4($|\?)/i.test(val) ? (
                          <video src={val} muted loop playsInline autoPlay className="w-full h-auto rounded" />
                        ) : (
                          <img src={val} alt={slot} className="w-full h-auto rounded" />
                        )}
                        <div className="flex gap-2">
                          <label className="px-2 py-1 border border-gray-300 rounded cursor-pointer text-sm text-gray-900 font-medium hover:bg-gray-50">Replace<input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(slot as any, f); setMedia({ [key]: url }) }} /></label>
                          <button className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 font-medium hover:bg-gray-50" onClick={() => setMedia({ [key]: null })}>Remove</button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center h-32 border-2 border-dashed rounded cursor-pointer text-sm text-gray-900">
                        <input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(slot as any, f); setMedia({ [key]: url }) }} />
                        Drop image/MP4 or click to upload
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Charts toggles */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Charts</h3>
            {(() => {
              const renderToggle = (metaKey: string, label: string, keySuffix: string = '') => (
                <label key={`${metaKey}${keySuffix ? `-${keySuffix}` : ''}`} className="flex items-center gap-2 text-gray-900">
                  <input
                    type="checkbox"
                    checked={draft?.meta?.chartsEnabled?.[metaKey as any] ?? true}
                    onChange={(e) => setMeta({ chartsEnabled: { ...(draft?.meta?.chartsEnabled||{}), [metaKey]: e.target.checked } })}
                  />
                  <span>{label}</span>
                </label>
              )

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-900">
                  {/* Metabolic Health */}
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Metabolic Health</div>
                    <div className="grid grid-cols-1 gap-2">
                      {renderToggle('plateauWeight','Plateau Prevention (Weight Loss Rate)')}
                      {renderToggle('morningFatBurnTrend','Morning Fat Burn %')}
                      {renderToggle('bodyFatTrend','Body Fat %')}
                    </div>
                  </div>

                  {/* Dietary Protocol */}
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Dietary Protocol</div>
                    <div className="grid grid-cols-1 gap-2">
                      {renderToggle('nutritionCompliancePct','Nutrition Compliance %')}
                      {renderToggle('projection','Weight Loss Trend vs. Projections')}
                      {renderToggle('weightTrend','Weight Trend Analysis')}
                    </div>
                  </div>

                  {/* Fitness Optimized */}
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Fitness Optimized</div>
                    <div className="grid grid-cols-1 gap-2">
                      {renderToggle('waistTrend','Waist Trend')}
                      {renderToggle('plateauWaist','Plateau Prevention — Waist')}
                      {tracksBP ? renderToggle('systolicTrend','Systolic Blood Pressure') : null}
                      {tracksBP ? renderToggle('diastolicTrend','Diastolic Blood Pressure') : null}
                      {renderToggle('strainTrend','Exercise Compliance %')}
                    </div>
                  </div>

                  {/* Discipline (includes mirrored toggles) */}
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Discipline</div>
                    <div className="grid grid-cols-1 gap-2">
                      {renderToggle('sleepTrend','Sleep Consistency')}
                      {renderToggle('disciplineNutritionCompliancePct','Nutrition Compliance %')}
                      {renderToggle('disciplineStrainTrend','Exercise Compliance %')}
                    </div>
                  </div>
                </div>
              )
            })()}
          </section>

          {/* Data Range */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Data Range</h3>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-900">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-900">Start week: 0</div>
                <label className="flex items-center gap-2">End week
                  <input
                    type="number"
                    className="ml-2 w-24 px-2 py-1 border rounded text-gray-900"
                    min={1}
                    max={Math.max(1, fullAvailableMaxWeek)}
                    value={(draft?.meta?.displayWeeks?.end ?? fullAvailableMaxWeek) || 1}
                    onChange={(e) => {
                      const raw = parseInt(e.target.value || '1', 10)
                      const clamped = Math.max(1, Math.min(raw, Math.max(1, fullAvailableMaxWeek)))
                      setMeta({ displayWeeks: { start: 1, end: clamped } })
                    }}
                  />
                </label>
              </div>
              <div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, fullAvailableMaxWeek)}
                  value={(draft?.meta?.displayWeeks?.end ?? fullAvailableMaxWeek) || 1}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value || '1', 10)
                    const clamped = Math.max(1, Math.min(raw, Math.max(1, fullAvailableMaxWeek)))
                    setMeta({ displayWeeks: { start: 1, end: clamped } })
                  }}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">Slide to reduce the displayed weeks. Defaults to full data range.</div>
              </div>
              {(draft?.meta?.displayWeeks?.end || 0) > fullAvailableMaxWeek && fullAvailableMaxWeek > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Requested end week ({draft?.meta?.displayWeeks?.end}) exceeds available data ({fullAvailableMaxWeek}). Preview will clamp to {fullAvailableMaxWeek}.
                </div>
              )}
            </div>
          </section>

          {/* Total Fat Loss (lbs) */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Total Fat Loss (lbs)</h3>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-900">
              <input
                type="number"
                step="0.1"
                className="w-40 px-2 py-1 border rounded text-gray-900"
                value={typeof draft?.meta?.totalFatLossLbs === 'number' ? draft.meta.totalFatLossLbs : ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') { setMeta({ totalFatLossLbs: null }); return }
                  const num = Number(v)
                  if (!Number.isNaN(num)) setMeta({ totalFatLossLbs: num })
                }}
                placeholder="e.g., 15.2"
              />
              <div className="text-xs text-gray-600">Fixed story value; does not change with displayed weeks.</div>
            </div>
          </section>

          {/* Branding removed by spec; tagline is centralized in marketingConfig */}

          {/* CTA removed by spec: centralized via marketingConfig */}

          {/* Client Testimonial (collapsed, lazy render) */}
          <section className="bg-white rounded border p-4">
            <details onToggle={(e) => { /* lazy-render gate via CSS-only summary; content renders below */ }}>
              <summary className="cursor-pointer select-none">
                <h3 className="font-semibold text-gray-900">Client Testimonial</h3>
                <div className="text-xs text-gray-600">Click to expand and manage testimonial content</div>
              </summary>

              <div className="mt-3">
                <label className="text-sm text-gray-900 block mb-1">Text Testimonial</label>
                <textarea value={draft?.meta?.testimonialQuote || ''} onChange={(e) => setMeta({ testimonialQuote: e.target.value })} className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-700" rows={3} placeholder="Short quote" />
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-900 block mb-1">Testimonial YouTube Link</label>
                <input type="text" value={draft?.media?.testimonial?.youtubeUrl || ''} onChange={(e) => setMedia({ testimonial: { ...(draft.media?.testimonial||{}), youtubeUrl: e.target.value } })} className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-700" placeholder="Paste a YouTube URL" />
              </div>

              {(() => {
                const groups: Array<{ key: 'front' | 'side' | 'rear'; heading: string }> = [
                  { key: 'front', heading: 'Front Body' },
                  { key: 'side', heading: 'Side Body' },
                  { key: 'rear', heading: 'Rear Body' }
                ]

                const getNested = (k: 'front' | 'side' | 'rear') => (draft?.media?.testimonial as any)?.[k] || {}
                const setNested = (k: 'front' | 'side' | 'rear', patch: any) => {
                  const current = (draft?.media?.testimonial as any) || {}
                  const next = { ...current, [k]: { ...(current[k] || {}), ...patch } }
                  setMedia({ testimonial: next })
                }

                const uploadKindFor = (k: 'front' | 'side' | 'rear', which: 'before' | 'after') => `testimonial_${k}_${which}` as const

                return (
                  <div className="mt-4 space-y-4">
                    {groups.map(({ key, heading }) => {
                      const g = getNested(key)
                      const beforeVal = g?.beforeUrl || null
                      const afterVal = g?.afterUrl || null
                      return (
                        <div key={key} className="border rounded p-3">
                          <div className="text-sm font-medium text-gray-900 mb-2">{heading}</div>
                          <div className="grid grid-cols-2 gap-3">
                            {[{ which: 'before', label: 'Before', val: beforeVal }, { which: 'after', label: 'After', val: afterVal }].map(({ which, label, val }) => (
                              <div key={which} className="border rounded p-3">
                                <div className="text-xs text-gray-900 mb-2">{label}</div>
                                {val ? (
                                  <div className="space-y-2">
                                    {/\.mp4($|\?)/i.test(val) ? (
                                      <video src={val} muted loop playsInline autoPlay className="w-full h-auto rounded" />
                                    ) : (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={val} alt={`${heading} ${label}`} className="w-full h-auto rounded" />
                                    )}
                                    <div className="flex gap-2">
                                      <label className="px-2 py-1 border border-gray-300 rounded cursor-pointer text-sm text-gray-900 font-medium">Replace<input type="file" className="hidden" accept="image/*,video/mp4" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const kind = uploadKindFor(key, which as any); const url2 = await upload(kind as any, f); setNested(key, { [`${which}Url`]: url2 }) }} /></label>
                                      <button className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 font-medium" onClick={() => setNested(key, { [`${which}Url`]: null })}>Remove</button>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="flex items-center justify-center h-28 border-2 border-dashed rounded cursor-pointer text-sm text-gray-900">
                                    <input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const kind = uploadKindFor(key, which as any); const url2 = await upload(kind as any, f); setNested(key, { [`${which}Url`]: url2 }) }} />
                                    {label}
                                  </label>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </details>
          </section>

          {/* Metabolic/Cardio Testing */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Metabolic/Cardio Testing</h3>
            <div className="border rounded p-3 space-y-2">
              <label className="text-sm text-gray-900 block">Link to testing (DocSend, Dropbox, etc.)</label>
              <input
                type="url"
                placeholder="https://..."
                className="w-full px-3 py-2 border rounded text-gray-900 placeholder-gray-700"
                value={draft?.media?.testing?.linkUrl || ''}
                onChange={(e) => setMedia({ testing: { ...(draft.media?.testing||{}), linkUrl: e.target.value } })}
              />
              {draft?.media?.testing?.linkUrl ? (
                <div className="text-xs text-gray-600">Saved link: <span className="break-all text-gray-900">{draft.media.testing.linkUrl}</span></div>
              ) : (
                <div className="text-xs text-gray-600">Enter a public link to display on the page</div>
              )}
            </div>
          </section>

          {/* Publish */}
          <section className="bg-white rounded border p-4">
            <button
              className={`px-4 py-2 rounded text-white ${publishing ? 'bg-green-700/70 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              aria-busy={publishing}
              disabled={publishing}
              onClick={async () => {
                beginPublishUI()
                setPublishing(true)
                const res = await fetch('/api/marketing/shares', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    patientId: initialDraft.patient_id,
                    alias: initialDraft.alias,
                    settings: {
                      displayNameMode: 'first_name',
                      captionsEnabled: true,
                      layout: 'stack',
                      watermarkText: draft?.meta?.watermarkText || null,
                      ctaLabel: draft?.meta?.ctaLabel || null,
                      displayNameOverride: draft?.meta?.displayNameOverride || null,
                      testimonialQuote: draft?.meta?.testimonialQuote || null,
                      totalFatLossLbs: typeof draft?.meta?.totalFatLossLbs === 'number' ? draft.meta.totalFatLossLbs : null,
                      chartsEnabled: draft?.meta?.chartsEnabled || {
                        weightTrend: true, projection: true, plateauWeight: true,
                        waistTrend: false, plateauWaist: false, nutritionCompliancePct: false,
                        sleepTrend: false, systolicTrend: false, diastolicTrend: false,
                        strainTrend: false,
                        morningFatBurnTrend: false, bodyFatTrend: false
                      },
                      displayWeeks: draft?.meta?.displayWeeks || undefined,
                      selectedMedia: draft?.media || {}
                    }
                  })
                })
                const json = await res.json()
                if (!res.ok) {
                  setPublishError(json.error || 'Publish failed')
                  setPublishing(false)
                } else {
                  setPublishSteps((s) => s.map((x) => x.id === 'pin' || x.id === 'build' || x.id === 'create' ? { ...x, status: 'done' } : (x.id === 'done' ? { ...x, status: 'done' } : x)))
                  setPublishing(false)
                }
              }}
            >
              {publishing ? (
                <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-full border-2 border-white/50 border-t-white animate-spin" /> Publishing…</span>
              ) : (
                'Publish version'
              )}
            </button>
            <div className="text-xs text-gray-600 mt-1">This may take up to 30 seconds.</div>

            {publishOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                <div className="bg-white rounded-lg shadow-lg border w-full max-w-md p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-1">Publishing</div>
                  <div className="text-xs text-gray-600 mb-2">Please wait up to 30 seconds.</div>
                  <ul className="space-y-2 text-sm">
                    {publishSteps.map(s => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.status==='done'?'bg-green-600':s.status==='in_progress'?'bg-blue-600':'bg-gray-300'}`} />
                        <span className="text-gray-900">{s.label}</span>
                      </li>
                    ))}
                  </ul>
                  {publishError ? (
                    <div className="mt-3 text-xs text-red-600">{publishError}</div>
                  ) : null}
                  <div className="mt-4 flex justify-end gap-2">
                    {(() => { const isDone = publishSteps.find(s => s.id==='done')?.status === 'done'; return (
                      <button className={`px-3 py-1.5 rounded text-sm ${isDone ? 'bg-green-600 text-white hover:bg-green-700' : 'border'} `} onClick={() => setPublishOpen(false)} disabled={publishing && !isDone}>Close</button>
                    )})()}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <section className="bg-white rounded border p-3">
            <div className="text-sm text-gray-900 mb-3">Live Preview</div>
            {preview ? (
              // Render AliasStoryClient directly for parity
              // eslint-disable-next-line @next/next/no-img-element
              <PreviewClient snapshot={preview} />
            ) : (
              <div className="text-xs text-gray-900">Preview will appear after the first save…</div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}


