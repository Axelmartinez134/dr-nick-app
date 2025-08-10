// src/app/components/health/marketing/MarketingTab.tsx
// Marketing content creation interface for Dr. Nick


'use client'

import { useState, useEffect, useCallback } from 'react'
import PatientSelector from './PatientSelector'
// import AnimationControls from './AnimationControls'
import AnimatedChartPreview from './AnimatedChartPreview'
import PlaceholderSections from './PlaceholderSections'

export default function MarketingTab() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🎬 Animation Control
            </h3>
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