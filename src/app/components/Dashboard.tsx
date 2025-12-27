// src/components/Dashboard.tsx
// Main dashboard with role-based routing

'use client'

import { useAuth } from './auth/AuthContext'
import DrNickPatientDashboard from './health/DrNickPatientDashboard'
import PatientDashboard from './health/PatientDashboard'

export default function Dashboard() {
  const { user, signOut, isDoctor, isPatient, loading } = useAuth()

  // Get user's first name for greeting - try multiple sources
  const getFirstName = () => {
    // Try user metadata first
    if (user?.user_metadata?.full_name) {
      const name = user.user_metadata.full_name.trim()
      if (name) return name.split(' ')[0]
    }
    
    // Try email as fallback (extract part before @)
    if (user?.email) {
      const emailName = user.email.split('@')[0]
      // Capitalize first letter and remove numbers/special chars
      return emailName.charAt(0).toUpperCase() + emailName.slice(1).replace(/[^a-zA-Z]/g, '')
    }
    
    return 'User'
  }

  const firstName = getFirstName()

  const handleSignOut = async () => {
    await signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile header (scrolls normally) */}
          <div className="md:hidden py-3">
            {/* Row 1: title left, sign out top-right */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[17px] font-semibold tracking-tight leading-tight text-gray-900 pr-2">
                🏥 The Fittest You Health Tracker
              </h1>
              <button
                onClick={handleSignOut}
                className="shrink-0 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded text-sm text-gray-800 transition-colors"
              >
                Sign Out
              </button>
            </div>

            {/* Row 2: welcome below */}
            <div className="mt-2 flex items-center gap-2 min-w-0">
              <span className="text-sm text-gray-700 truncate">
                Welcome, {isDoctor ? 'Dr. Nick' : firstName}!
              </span>
              {isDoctor && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded whitespace-nowrap">
                  Doctor Portal
                </span>
              )}
            </div>
          </div>

          {/* Desktop header (unchanged) */}
          <div className="hidden md:flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                🏥 The Fittest You Health Tracker
              </h1>
              {isDoctor && (
                <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                  Doctor Portal
                </span>
              )}
            </div>

            {/* User Info and Sign Out */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {isDoctor ? 'Dr. Nick' : firstName}!
              </span>
              <button
                onClick={handleSignOut}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm text-gray-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Role-Based Dashboard */}
      {isDoctor && <DrNickPatientDashboard />}
      {isPatient && <PatientDashboard />}

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            The Fittest You Health Tracker - {isDoctor ? 'Client Management System' : 'Stay on track with your weekly check-ins!'} 📋
          </div>
        </div>
      </footer>

    </div>
  )
}