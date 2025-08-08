// src/app/components/health/marketing/MarketingTab.tsx
// Marketing content creation interface for Dr. Nick

'use client'

import { useState, useEffect } from 'react'
import PatientSelector from './PatientSelector'
import AnimationControls from './AnimationControls'
import AnimatedChartPreview from './AnimatedChartPreview'
import PlaceholderSections from './PlaceholderSections'

export default function MarketingTab() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [animationSpeed, setAnimationSpeed] = useState('slow')
  const [isAnimating, setIsAnimating] = useState(false)

  const handleStartAnimation = () => {
    setIsAnimating(true)
    // Animation will automatically reset after duration
    setTimeout(() => {
      setIsAnimating(false)
    }, 4000) // 4 seconds for "slow" animation
  }

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

          {/* Animation Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🎛️ Animation Speed
            </h3>
            <AnimationControls 
              selectedSpeed={animationSpeed}
              onSpeedChange={setAnimationSpeed}
            />
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
              onAnimationComplete={() => setIsAnimating(false)}
            />
          </div>
        </div>

      </div>
    </div>
  )
} 