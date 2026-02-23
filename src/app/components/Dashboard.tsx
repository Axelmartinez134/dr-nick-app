// src/components/Dashboard.tsx
// Main dashboard with role-based routing

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, useAuth } from './auth/AuthContext'
import DrNickPatientDashboard from './health/DrNickPatientDashboard'
import PatientDashboard from './health/PatientDashboard'

export default function Dashboard() {
  const { user, signOut, isDoctor, isPatient, loading } = useAuth()
  const router = useRouter()
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(true)

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

  useEffect(() => {
    let cancelled = false

    // Only gate real patients (never Dr. Nick, never editor users).
    if (!user || loading || !isPatient) return

    ;(async () => {
      try {
        setOnboardingChecked(false)
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) {
          setOnboardingComplete(true)
          setOnboardingChecked(true)
          return
        }

        const res = await fetch('/api/auth/onboarding/status', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !json?.success) {
          // If the gate check fails, do not hard-block the user (avoid lockouts).
          setOnboardingComplete(true)
          setOnboardingChecked(true)
          return
        }

        const complete = Boolean(json.complete)
        setOnboardingComplete(complete)
        setOnboardingChecked(true)

        if (!complete) {
          router.replace('/onboarding')
        }
      } catch {
        if (cancelled) return
        // Fail-open to avoid blocking access if the API is temporarily down.
        setOnboardingComplete(true)
        setOnboardingChecked(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, loading, isPatient, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  // IMPORTANT: Do not block-render a loading screen while checking onboarding.
  // That would unmount the patient UI and wipe in-progress state (form drafts, slider range, etc.).

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden md:overflow-x-visible">
      
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
      {isPatient && onboardingComplete && <PatientDashboard />}

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