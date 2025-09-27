'use client'

import { useEffect, useMemo, useState } from 'react'
import PreviewClient from './PreviewClient'

export default function EditorClient({ draftId, initialDraft }: { draftId: string; initialDraft: any }) {
  const [draft, setDraft] = useState<any>(initialDraft?.draft_json || initialDraft)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any | null>(null)

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

  const setMedia = (patch: any) => setDraft((d: any) => ({ ...d, media: { ...(d?.media || {}), ...patch } }))
  const setMeta = (patch: any) => setDraft((d: any) => ({ ...d, meta: { ...(d?.meta || {}), ...patch } }))

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
          <div className="text-sm text-gray-700">
            <span className="font-medium">Edit Draft</span> {patientAlias}
          </div>
          <div className="text-xs">
            {saving ? <span className="text-gray-600">Saving…</span> : saveError ? <span className="text-red-600">Save failed — Retry</span> : <span className="text-green-700">Saved</span>}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Left: Editor panels */}
        <div className="space-y-6">
          {/* Charts toggles */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Charts</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['weightTrend','Weight Trend'],
                ['projection','Projections'],
                ['plateauWeight','Plateau Weight'],
                ['waistTrend','Waist Trend'],
                ['plateauWaist','Plateau Waist'],
                ['nutritionCompliancePct','Nutrition %'],
                ['sleepTrend','Sleep Consistency'],
                ['morningFatBurnTrend','Morning Fat Burn %'],
                ['bodyFatTrend','Body Fat %'],
              ].map(([key,label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={!!draft?.meta?.chartsEnabled?.[key as any]} onChange={(e) => setMeta({ chartsEnabled: { ...(draft?.meta?.chartsEnabled||{}), [key]: e.target.checked } })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Branding */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Branding</h3>
            <label className="text-sm text-gray-700 block mb-1">Watermark text</label>
            <input className="w-full px-3 py-2 border rounded" value={draft?.meta?.watermarkText || ''} onChange={(e) => setMeta({ watermarkText: e.target.value })} placeholder="The Fittest You" />
          </section>

          {/* CTA */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">CTA</h3>
            <label className="text-sm text-gray-700 block mb-1">CTA label</label>
            <input className="w-full px-3 py-2 border rounded" value={draft?.meta?.ctaLabel || ''} onChange={(e) => setMeta({ ctaLabel: e.target.value })} placeholder="Book a consult" />
          </section>

          {/* Identity */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Identity</h3>
            <div className="flex gap-3 items-center text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="displayNameMode" checked={(draft?.meta?.displayNameMode || 'first_name') === 'first_name'} onChange={() => setMeta({ displayNameMode: 'first_name' })} /> First name</label>
              <label className="flex items-center gap-2"><input type="radio" name="displayNameMode" checked={(draft?.meta?.displayNameMode || 'first_name') === 'anonymous'} onChange={() => setMeta({ displayNameMode: 'anonymous' })} /> Anonymous</label>
            </div>
            <label className="text-sm text-gray-700 block mt-3 mb-1">Custom label override</label>
            <input className="w-full px-3 py-2 border rounded" value={draft?.meta?.displayNameOverride || ''} onChange={(e) => setMeta({ displayNameOverride: e.target.value })} placeholder="Custom label (optional)" />
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
                    <div className="text-xs text-gray-700 mb-2">{slot === 'before' ? 'Before' : 'After'}</div>
                    {val ? (
                      <div className="space-y-2">
                        {/\.mp4($|\?)/i.test(val) ? (
                          <video src={val} muted loop playsInline autoPlay className="w-full h-auto rounded" />
                        ) : (
                          <img src={val} alt={slot} className="w-full h-auto rounded" />
                        )}
                        <div className="flex gap-2">
                          <label className="px-2 py-1 border rounded cursor-pointer text-sm">Replace<input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(slot as any, f); setMedia({ [key]: url }) }} /></label>
                          <button className="px-2 py-1 border rounded text-sm" onClick={() => setMedia({ [key]: null })}>Remove</button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center h-32 border-2 border-dashed rounded cursor-pointer text-sm text-gray-600">
                        <input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(slot as any, f); setMedia({ [key]: url }) }} />
                        Drop image/MP4 or click to upload
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Loop video */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Loop (MP4)</h3>
            <div className="border rounded p-3">
              {draft?.media?.loopVideoUrl ? (
                <div className="space-y-2">
                  <video src={draft.media.loopVideoUrl} muted loop playsInline autoPlay className="w-full h-auto" />
                  <div className="flex gap-2">
                    <label className="px-2 py-1 border rounded cursor-pointer text-sm">Replace<input type="file" accept="video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload('loop', f); setMedia({ loopVideoUrl: url }) }} /></label>
                    <button className="px-2 py-1 border rounded text-sm" onClick={() => setMedia({ loopVideoUrl: null })}>Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center h-28 border-2 border-dashed rounded cursor-pointer text-sm text-gray-600">
                  <input type="file" accept="video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload('loop', f); setMedia({ loopVideoUrl: url }) }} />
                  Drop MP4 or click to upload (auto-plays muted, loops)
                </label>
              )}
            </div>
          </section>

          {/* Fit3D (max 2) */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Fit3D (max 2)</h3>
            <div className="grid grid-cols-2 gap-3">
              {[0,1].map((idx) => {
                const arr: string[] = (draft?.media?.fit3d?.images || [])
                const url = arr[idx] || null
                return (
                  <div key={idx} className="border rounded p-3">
                    <div className="text-xs text-gray-700 mb-2">{url ? `Item ${idx+1}` : `Add ${idx===0?'first':'second'}`}</div>
                    {url ? (
                      <div className="space-y-2">
                        {/\.mp4($|\?)/i.test(url) ? (
                          <video src={url} muted loop playsInline autoPlay className="w-full h-auto" />
                        ) : (
                          <img src={url} alt={`fit3d-${idx+1}`} className="w-full h-auto rounded" />
                        )}
                        <div className="flex gap-2">
                          <label className="px-2 py-1 border rounded cursor-pointer text-sm">Replace<input type="file" className="hidden" accept="image/*,video/mp4" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url2 = await upload('fit3d', f, idx); const next = [...arr]; next[idx] = url2; setMedia({ fit3d: { ...(draft.media?.fit3d||{}), images: next } }) }} /></label>
                          <button className="px-2 py-1 border rounded text-sm" onClick={() => { const next = [...arr]; next[idx] = ''; setMedia({ fit3d: { ...(draft.media?.fit3d||{}), images: next.filter(Boolean) } }) }}>Remove</button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center h-28 border-2 border-dashed rounded cursor-pointer text-sm text-gray-600">
                        <input type="file" accept="image/*,video/mp4" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url2 = await upload('fit3d', f, idx); const next = [...arr]; next[idx] = url2; setMedia({ fit3d: { ...(draft.media?.fit3d||{}), images: next.filter(Boolean) } }) }} />
                        {idx===0 ? 'Add first' : 'Add second'}
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-700 block mb-1">YouTube ID (optional)</label>
              <input type="text" value={draft?.media?.fit3d?.youtubeId || ''} onChange={(e) => setMedia({ fit3d: { ...(draft.media?.fit3d||{}), youtubeId: e.target.value } })} className="w-full px-3 py-2 border rounded" placeholder="e.g., dQw4w9WgXcQ" />
            </div>
          </section>

          {/* Testing (DocSend) */}
          <section className="bg-white rounded border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Testing (DocSend)</h3>
            <input type="url" value={draft?.media?.testing?.docsendUrl || ''} onChange={(e) => setMedia({ testing: { ...(draft.media?.testing||{}), docsendUrl: e.target.value } })} className="w-full px-3 py-2 border rounded" placeholder="https://docs.docsend.com/..." />
          </section>

          {/* Publish */}
          <section className="bg-white rounded border p-4">
            <button
              className="px-4 py-2 rounded bg-green-600 text-white"
              onClick={async () => {
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
                      chartsEnabled: {
                        weightTrend: true, projection: true, plateauWeight: true,
                        waistTrend: false, plateauWaist: false, nutritionCompliancePct: false,
                        sleepTrend: false, morningFatBurnTrend: false, bodyFatTrend: false
                      },
                      selectedMedia: draft?.media || {}
                    }
                  })
                })
                const json = await res.json()
                if (!res.ok) {
                  alert(json.error || 'Publish failed')
                } else {
                  alert(`Published ${json.alias} → ${json.slug}`)
                }
              }}
            >
              Publish version
            </button>
          </section>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <section className="bg-white rounded border p-3">
            <div className="text-sm text-gray-700 mb-3">Live Preview</div>
            {preview ? (
              // Render AliasStoryClient directly for parity
              // eslint-disable-next-line @next/next/no-img-element
              <PreviewClient snapshot={preview} />
            ) : (
              <div className="text-xs text-gray-500">Preview will appear after the first save…</div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}


