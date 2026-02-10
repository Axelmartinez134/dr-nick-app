'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../components/auth/AuthContext'

type Status = 'idle' | 'loading' | 'ready' | 'success' | 'error'

export default function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string>('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const code = useMemo(() => searchParams?.get('code') || '', [searchParams])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setStatus('loading')
        setMessage('')

        // Support code-based recovery links.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            if (!cancelled) {
              setStatus('error')
              setMessage(error.message || 'Invalid or expired recovery link.')
            }
            return
          }
        }

        // Support hash-token recovery links (Supabase can auto-detect session in URL).
        const { data } = await supabase.auth.getSession()
        if (!data?.session) {
          if (!cancelled) {
            setStatus('error')
            setMessage('No recovery session found. Please request a new password reset email.')
          }
          return
        }

        if (!cancelled) {
          setStatus('ready')
        }
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error')
          setMessage(e?.message || 'Failed to initialize password reset.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return

    setMessage('')

    const p1 = String(newPassword || '')
    const p2 = String(confirmPassword || '')
    if (!p1 || p1.length < 8) {
      setMessage('Password must be at least 8 characters.')
      return
    }
    if (p1 !== p2) {
      setMessage('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      if (!accessToken) {
        setStatus('error')
        setMessage('Recovery session expired. Please request a new reset email.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password: p1 })
      if (error) {
        setStatus('error')
        setMessage(error.message || 'Failed to update password.')
        return
      }

      // Explicit requirement: keep profiles.patient_password in sync with the new plaintext password.
      const res = await fetch('/api/auth/sync-plaintext-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password: p1 }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Password is already updated in Supabase Auth; treat this as a warning (fail-open) to avoid trapping the user.
        setStatus('success')
        setMessage(
          (json?.error ? `Password updated. Admin sync failed: ${json.error}` : 'Password updated. Admin sync failed.') +
            ' Please contact Dr. Nick if you need your password re-saved.',
        )
      } else {
        setStatus('success')
        setMessage('Password updated successfully. You can now sign in.')
      }

      // Give the user a moment to read success state, then route home.
      setTimeout(() => {
        router.replace('/')
      }, 800)
    } catch (e: any) {
      setStatus('error')
      setMessage(e?.message || 'Unexpected error updating password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center">Reset Password</h1>

          {message ? (
            <div
              className={`mt-4 p-3 rounded text-sm ${
                status === 'success' ? 'bg-green-100 text-green-700' : status === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-800'
              }`}
            >
              {message}
            </div>
          ) : null}

          {status === 'loading' ? (
            <div className="mt-6 text-center text-gray-600">Loading…</div>
          ) : null}

          {status === 'ready' ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Enter a new password"
                  disabled={busy}
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Re-enter the new password"
                  disabled={busy}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className={`w-full py-2 px-4 rounded-md font-medium ${
                  busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } text-white transition-colors`}
              >
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          ) : null}

          {status === 'error' ? (
            <div className="mt-6">
              <button
                type="button"
                className="w-full py-2 px-4 rounded-md font-medium border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-colors"
                onClick={() => router.replace('/')}
              >
                Back to sign in
              </button>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="mt-6">
              <button
                type="button"
                className="w-full py-2 px-4 rounded-md font-medium border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-colors"
                onClick={() => router.replace('/')}
              >
                Continue to sign in
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

