'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../components/auth/AuthContext'

type UnitSystem = 'imperial' | 'metric'

export default function OnboardingPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [startingWeight, setStartingWeight] = useState('')
  const [startingWaist, setStartingWaist] = useState('')
  const [height, setHeight] = useState('')
  const [trackBloodPressure, setTrackBloodPressure] = useState<boolean | null>(null)
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')

  const bpEnabled = trackBloodPressure === true

  const heightLabel = useMemo(() => (unitSystem === 'metric' ? 'cm' : 'inches'), [unitSystem])
  const weightLabel = useMemo(() => (unitSystem === 'metric' ? 'kg' : 'lbs'), [unitSystem])
  const waistLabel = useMemo(() => (unitSystem === 'metric' ? 'cm' : 'inches'), [unitSystem])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setMessage('')

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) {
          router.replace('/')
          return
        }

        const res = await fetch('/api/auth/onboarding/status', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          if (!cancelled) setMessage(json?.error || 'Failed to load onboarding status.')
          return
        }

        // If already complete, bounce home.
        if (json.complete) {
          router.replace('/')
          return
        }
      } catch (e: any) {
        if (!cancelled) setMessage(e?.message || 'Failed to load onboarding.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setMessage('')

    if (!startingWeight.trim() || !startingWaist.trim() || !height.trim()) {
      setMessage('Starting weight, waist, and height are required.')
      return
    }
    if (typeof trackBloodPressure !== 'boolean') {
      setMessage('Please select whether to track blood pressure.')
      return
    }

    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        router.replace('/')
        return
      }

      const res = await fetch('/api/auth/onboarding/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          unitSystem,
          startingWeight,
          startingWaist,
          height,
          trackBloodPressure,
          // Optional UI-only fields (not stored)
          systolicBp: bpEnabled ? systolicBp : undefined,
          diastolicBp: bpEnabled ? diastolicBp : undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setMessage(json?.error || 'Failed to complete onboarding.')
        return
      }

      router.replace('/')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to complete onboarding.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center">Complete your onboarding</h1>
          <p className="mt-2 text-sm text-gray-600 text-center">
            We need your baseline measurements to finish setting up your account.
          </p>

          {message ? (
            <div className="mt-4 p-3 rounded bg-red-100 text-red-700 text-sm">
              {message}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-center text-gray-600">Loading…</div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="unitSystem" className="block text-sm font-medium text-gray-700 mb-1">
                  Measurement system
                </label>
                <select
                  id="unitSystem"
                  value={unitSystem}
                  onChange={(e) => setUnitSystem(e.target.value === 'metric' ? 'metric' : 'imperial')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  disabled={saving}
                >
                  <option value="imperial">Imperial (lbs / inches)</option>
                  <option value="metric">Metric (kg / cm)</option>
                </select>
              </div>

              <div>
                <label htmlFor="startingWeight" className="block text-sm font-medium text-gray-700 mb-1">
                  Starting weight ({weightLabel})
                </label>
                <input
                  id="startingWeight"
                  type="number"
                  inputMode="decimal"
                  value={startingWeight}
                  onChange={(e) => setStartingWeight(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label htmlFor="startingWaist" className="block text-sm font-medium text-gray-700 mb-1">
                  Starting waist ({waistLabel})
                </label>
                <input
                  id="startingWaist"
                  type="number"
                  inputMode="decimal"
                  value={startingWaist}
                  onChange={(e) => setStartingWaist(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
                  Height ({heightLabel})
                </label>
                <input
                  id="height"
                  type="number"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <div className="block text-sm font-medium text-gray-700 mb-1">Track blood pressure?</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackBloodPressure(true)}
                    disabled={saving}
                    className={`flex-1 py-2 px-3 rounded-md border text-sm font-semibold transition-colors ${
                      trackBloodPressure === true
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackBloodPressure(false)}
                    disabled={saving}
                    className={`flex-1 py-2 px-3 rounded-md border text-sm font-semibold transition-colors ${
                      trackBloodPressure === false
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {bpEnabled ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="systolicBp" className="block text-sm font-medium text-gray-700 mb-1">
                      Systolic (optional)
                    </label>
                    <input
                      id="systolicBp"
                      type="number"
                      inputMode="numeric"
                      value={systolicBp}
                      onChange={(e) => setSystolicBp(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label htmlFor="diastolicBp" className="block text-sm font-medium text-gray-700 mb-1">
                      Diastolic (optional)
                    </label>
                    <input
                      id="diastolicBp"
                      type="number"
                      inputMode="numeric"
                      value={diastolicBp}
                      onChange={(e) => setDiastolicBp(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className={`w-full py-2 px-4 rounded-md font-medium ${
                  saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } text-white transition-colors`}
              >
                {saving ? 'Saving…' : 'Finish onboarding'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

