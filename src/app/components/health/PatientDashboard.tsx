// src/app/components/health/PatientDashboard.tsx
// Simplified dashboard for patients - only their own data and check-ins

'use client'

import { useState } from 'react'
import HealthForm from './HealthForm'
import ChartsDashboard from './ChartsDashboard'

export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState('progress')

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            
            <button
              onClick={() => setActiveTab('progress')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'progress'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 My Progress
            </button>

            <button
              onClick={() => setActiveTab('checkin')}
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
        
        {/* My Progress Tab */}
        {activeTab === 'progress' && (
          <div>
            <ChartsDashboard />
          </div>
        )}

        {/* Weekly Check-in Tab */}
        {activeTab === 'checkin' && (
          <div>
            <HealthForm />
          </div>
        )}

      </main>

    </div>
  )
} 