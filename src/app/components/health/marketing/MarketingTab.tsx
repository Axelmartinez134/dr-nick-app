// src/app/components/health/marketing/MarketingTab.tsx
// Marketing content creation interface for Dr. Nick


'use client'

import { useState, useEffect, useCallback } from 'react'
import { sanitizeAlias, isAliasValidFormat } from './aliasUtils'
import PatientSelector from './PatientSelector'
import LinkManager from './LinkManager'
// import AnimationControls from './AnimationControls'
import AnimatedChartPreview from './AnimatedChartPreview'
import PlaceholderSections from './PlaceholderSections'
import { useRouter } from 'next/navigation'

export default function MarketingTab() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [alias, setAlias] = useState<string>('')
  const [aliasSanitized, setAliasSanitized] = useState<string>('')
  const [aliasStatus, setAliasStatus] = useState<'idle' | 'checking' | 'invalid' | 'available' | 'taken'>('idle')
  const [publishing, setPublishing] = useState<boolean>(false)
  const [publishResult, setPublishResult] = useState<{ slug: string; alias: string } | null>(null)
  const [animationSpeed, setAnimationSpeed] = useState('slow')
  const [isAnimating, setIsAnimating] = useState(false)
  const [isRecordingMode, setIsRecordingMode] = useState(false)
  const [privacyMode, setPrivacyMode] = useState(true)
  const [showCaptions, setShowCaptions] = useState(true)
  const [showSafeZones, setShowSafeZones] = useState(true)
  const [layoutMode, setLayoutMode] = useState<'stack' | 'three-up'>('stack')
  const [sceneDurationSec, setSceneDurationSec] = useState<number>(30)

  const handleStartAnimation = () => {
    // Start and let the preview determine when to complete based on Scene Duration
    setIsAnimating(true)
  }

  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false)
  }, [])

  const router = useRouter()

  // Debounced alias sanitize + availability check
  useEffect(() => {
    const next = sanitizeAlias(alias || '')
    setAliasSanitized(next)
    if (!next) {
      setAliasStatus('idle')
      return
    }
    if (!isAliasValidFormat(next)) {
      setAliasStatus('invalid')
      return
    }
    setAliasStatus('checking')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/marketing/aliases/${encodeURIComponent(next)}`, { cache: 'no-store' })
        if (res.ok) {
          setAliasStatus('taken')
        } else {
          setAliasStatus('available')
        }
      } catch {
        setAliasStatus('available')
      }
    }, 300)
    return () => clearTimeout(t)
  }, [alias])

  const handleQuickPublish = async () => {
    try {
      if (!selectedPatientId) return
      const res = await fetch('/api/marketing/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          alias: aliasSanitized,
          settings: {
            displayNameMode: 'first_name',
            captionsEnabled: true,
            layout: 'stack',
            // Let server compute full chartsEnabled defaults (14 flags, BP conditional)
            selectedMedia: {}
          }
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Publish failed')
      router.push(`/${json.alias}`)
    } catch (e) {
      console.error('Quick publish failed', e)
      const msg = e instanceof Error ? e.message : 'Publish failed'
      alert(msg)
    }
  }

  const handleWizardPublish = async () => {
    try {
      if (!selectedPatientId || aliasStatus !== 'available') return
      setPublishing(true)
      setPublishResult(null)
      const res = await fetch('/api/marketing/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          alias: aliasSanitized,
          settings: {
            displayNameMode: 'first_name',
            captionsEnabled: true,
            layout: 'stack',
            // Let server compute full chartsEnabled defaults (14 flags, BP conditional)
            selectedMedia: {}
          }
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Publish failed')
      setPublishResult({ slug: json.slug, alias: json.alias })
    } catch (e) {
      console.error('Publish failed', e)
      const msg = e instanceof Error ? e.message : 'Publish failed'
      alert(msg)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Create Link Wizard */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔗 Create Link (Wizard)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1: Client & Alias */}
          <div className="space-y-3 md:col-span-2">
            <div>
              <label className="text-sm text-gray-700 block mb-1">Select client</label>
              <PatientSelector 
                selectedPatientId={selectedPatientId}
                onPatientSelect={setSelectedPatientId}
              />
            </div>
            <div>
              <label className="text-sm text-gray-700 block mb-1">Alias</label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="e.g., areg"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                aria-invalid={aliasStatus === 'invalid' || aliasStatus === 'taken'}
              />
              <div className="text-xs text-gray-500 mt-1">Your page will be at <span className="font-mono">/{aliasSanitized || 'alias'}</span>.</div>
              <div className="mt-1 text-xs">
                {aliasStatus === 'idle' && <span className="text-gray-400">Enter an alias to check availability.</span>}
                {aliasStatus === 'checking' && <span className="text-gray-500">Checking availability…</span>}
                {aliasStatus === 'invalid' && <span className="text-red-600">Invalid or reserved. Use lowercase letters, numbers, and hyphens.</span>}
                {aliasStatus === 'available' && <span className="text-green-700">Available</span>}
                {aliasStatus === 'taken' && <span className="text-red-600">Taken. Choose a different alias.</span>}
              </div>
            </div>
          </div>

          {/* Step 2: Defaults (read-only) */}
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm font-semibold text-gray-800 mb-1">Defaults</div>
            <ul className="text-xs text-gray-600 list-disc ml-4 space-y-1">
              <li>Layout: stack</li>
              <li>Captions: on</li>
              <li>Charts on: Weight Trend, Projections, Plateau Weight</li>
              <li>Charts off: Waist, Sleep, Nutrition %, Morning Fat Burn %, Body Fat %</li>
              <li>Unit: Imperial (locked)</li>
            </ul>
            <div className="text-[11px] text-gray-500 mt-2">You can change settings later in the Editor.</div>
          </div>
        </div>

        {/* Step 3: Publish */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleWizardPublish}
            disabled={!selectedPatientId || aliasStatus !== 'available' || publishing}
            className={`px-4 py-2 rounded font-medium ${(!selectedPatientId || aliasStatus !== 'available' || publishing) ? 'bg-gray-300 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}
          >
            {publishing ? 'Publishing…' : `Publish snapshot`}
          </button>
          {publishResult && (
            <div className="text-sm text-gray-700 flex items-center gap-2">
              <span>Published “{publishResult.alias}” → {publishResult.slug}</span>
              <a className="text-blue-600 underline" href={`/${publishResult.alias}`} target="_blank">Open Alias</a>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${publishResult.alias}`)} className="text-xs text-gray-600 underline">Copy</button>
              <a className="text-blue-600 underline" href={`/version/${publishResult.slug}`} target="_blank">Open Version</a>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/version/${publishResult.slug}`)} className="text-xs text-gray-600 underline">Copy</button>
              <button
                className="ml-2 text-xs px-2 py-1 border rounded"
                onClick={async () => {
                  const res = await fetch('/api/marketing/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: selectedPatientId, alias: publishResult.alias }) })
                  const json = await res.json()
                  if (!res.ok) { alert(json.error || 'Failed to create draft'); return }
                  window.location.href = `/admin/marketing/editor/${json.draftId}`
                }}
              >
                Continue editing
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Link Manager (Active Links) */}
      <LinkManager />

      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎬 Content Creation Studio
            </h2>
            <p className="text-gray-600">
              Create engaging social media content showcasing client progress
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">MVP Version</div>
            <div className="text-xs text-gray-400">More features coming soon!</div>
          </div>
        </div>
      </div>

      {/* Main Layout - 3 Column Design */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Controls */}
        <div className="space-y-6">
          
          {/* Data Source Selection */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Data Source
            </h3>
            <PatientSelector 
              selectedPatientId={selectedPatientId}
              onPatientSelect={setSelectedPatientId}
            />
          </div>

          {/* Animation Speed removed per request */}

          {/* Recording & Layout Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎥 Recording & Layout</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Recording Mode (9:16, hide UI chrome)</label>
                <input
                  type="checkbox"
                  checked={isRecordingMode}
                  onChange={(e) => setIsRecordingMode(e.target.checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Privacy Mode (hide names)</label>
                <input
                  type="checkbox"
                  checked={privacyMode}
                  onChange={(e) => setPrivacyMode(e.target.checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Smart Captions</label>
                <input
                  type="checkbox"
                  checked={showCaptions}
                  onChange={(e) => setShowCaptions(e.target.checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">IG Safe Zones</label>
                <input
                  type="checkbox"
                  checked={showSafeZones}
                  onChange={(e) => setShowSafeZones(e.target.checked)}
                />
              </div>
              <div className="mt-2">
                <label className="text-sm text-gray-700 block mb-2">Layout Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLayoutMode('stack')}
                    className={`px-3 py-2 rounded border text-sm ${layoutMode === 'stack' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    Full Stack (Client-like)
                  </button>
                  <button
                    onClick={() => setLayoutMode('three-up')}
                    className={`px-3 py-2 rounded border text-sm ${layoutMode === 'three-up' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    3-up (Progress Trio)
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-700 block mb-2">Scene Duration: {sceneDurationSec}s</label>
                <input
                  type="range"
                  min={0}
                  max={45}
                  step={1}
                  value={sceneDurationSec}
                  onChange={(e) => setSceneDurationSec(parseInt(e.target.value) || 0)}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">Controls how long the animation takes from start to finish (0–45s)</div>
              </div>
              <div className="text-xs text-gray-500 mt-1">Hotkeys: R = Record, F = Fullscreen, Esc = Exit Fullscreen</div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎬 Animation Control</h3>
            <button
              onClick={handleStartAnimation}
              disabled={!selectedPatientId || isAnimating}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                !selectedPatientId || isAnimating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isAnimating ? 'Playing Animation...' : '▶️ Start Animation'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Charts will animate from Week 0 to latest week
            </p>
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">⚡ Quick Publish</h4>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Alias (e.g., andrea)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 mb-2"
            />
            <button
              onClick={handleQuickPublish}
              disabled={!selectedPatientId}
              className={`w-full py-2 px-3 rounded font-medium ${!selectedPatientId ? 'bg-gray-300 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              Publish & View /{alias || 'alias'}
            </button>
            <p className="text-xs text-gray-500 mt-2">Publishes a snapshot with sensible defaults and opens the public link.</p>
          </div>
          </div>

          {/* Placeholder Sections */}
          <PlaceholderSections />
        </div>

        {/* Right Column - Preview Area (spans 2 columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📺 Live Preview
            </h3>
            <AnimatedChartPreview 
              patientId={selectedPatientId}
              animationSpeed={animationSpeed}
              isAnimating={isAnimating}
              onAnimationComplete={handleAnimationComplete}
              isRecordingMode={isRecordingMode}
              privacyMode={privacyMode}
              showCaptions={showCaptions}
              showSafeZones={showSafeZones}
              layoutMode={layoutMode}
              durationSeconds={sceneDurationSec}
            />
          </div>
        </div>

      </div>
    </div>
  )
} 