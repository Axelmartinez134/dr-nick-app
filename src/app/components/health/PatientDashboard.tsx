// src/app/components/health/PatientDashboard.tsx
// Simplified dashboard for patients - only their own data and check-ins

'use client'

import { useState } from 'react'
import HealthForm from './HealthForm'
import ChartsDashboard from './ChartsDashboard'

export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('patientDashboard:activeTab')
      return saved === 'checkin' ? 'checkin' : 'progress'
    } catch {
      return 'progress'
    }
  })

  // Persist active tab so switching away/back doesn't reset.
  // (sessionStorage survives reloads within the same tab/session)
  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab)
    try { sessionStorage.setItem('patientDashboard:activeTab', tab) } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            
            <button
              onClick={() => handleSetActiveTab('progress')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'progress'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 My Progress
            </button>

            <button
              onClick={() => handleSetActiveTab('checkin')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'checkin'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Weekly Check-in
            </button>

          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* Keep both tabs mounted so switching doesn't reset state */}
        <div
          className={activeTab === 'progress' ? 'block' : 'hidden'}
          aria-hidden={activeTab !== 'progress'}
        >
          <ChartsDashboard />
        </div>

        <div
          className={activeTab === 'checkin' ? 'block' : 'hidden'}
          aria-hidden={activeTab !== 'checkin'}
        >
          <HealthForm />
        </div>

      </main>

    </div>
  )
} 