// src/components/auth/Login.tsx
// Login form for existing users

'use client'

import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function Login() {
  type Mode = 'signin' | 'signup'
  type MessageKind = 'success' | 'error' | 'info'

  // Form state
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<MessageKind>('info')

  // Get signIn function from our auth context
  const { signIn } = useAuth()

  const handleRequestPasswordReset = async () => {
    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setMessageKind('error')
        setMessage(json?.error || 'Failed to request password reset.')
      } else {
        setMessageKind('success')
        setMessage(json?.message || 'If an account exists, a reset email has been sent.')
        setShowForgotPassword(false)
      }
    } catch (e: any) {
      setMessageKind('error')
      setMessage(e?.message || 'Failed to request password reset.')
    } finally {
      setLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      try {
        if (!fullName.trim()) {
          setMessageKind('error')
          setMessage('Full name is required.')
          return
        }
        if (!email.trim()) {
          setMessageKind('error')
          setMessage('Email is required.')
          return
        }
        if (!password) {
          setMessageKind('error')
          setMessage('Password is required.')
          return
        }
        if (password.length < 8) {
          setMessageKind('error')
          setMessage('Password must be at least 8 characters.')
          return
        }

        const res = await fetch('/api/auth/public-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            email,
            password,
          }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setMessageKind('error')
          setMessage(json?.error || 'Failed to create account.')
          return
        }

        setMessageKind('success')
        setMessage('Account created successfully! Check your email to confirm your account, then sign in to complete onboarding.')
        setMode('signin')
        setShowForgotPassword(false)
        // Keep email filled in to make sign-in easier after confirmation.
        setPassword('')
      } catch (e: any) {
        setMessageKind('error')
        setMessage(e?.message || 'Failed to create account.')
      } finally {
        setLoading(false)
      }
      return
    }

    const { data, error } = await signIn(email, password)

    if (error) {
      setMessageKind('error')
      setMessage(error.message)
    } else {
      // Redirects are handled centrally (e.g. / → /editor) to avoid double navigation / full reloads.
      setMessageKind('success')
      setMessage('Login successful! Redirecting...')
    }
    
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setShowForgotPassword(false)
                setMessage('')
                setMessageKind('info')
              }}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={loading}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setShowForgotPassword(false)
                setMessage('')
                setMessageKind('info')
              }}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={loading}
            >
              Create Account
            </button>
          </div>
        </div>

        <h2 className="mt-4 text-2xl font-bold text-center text-gray-900 mb-6">
          {mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
        </h2>

        {/* Display messages (success/error) */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
            messageKind === 'success'
              ? 'bg-green-100 text-green-700'
              : messageKind === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-50 text-blue-800'
          }`}>
            {message}
          </div>
        )}

        {/* Sign In / Create Account Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === 'signup' ? (
            <>
              {/* Full name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Enter your full name"
                  disabled={loading}
                />
              </div>
            </>
          ) : null}

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          {/* Password Input (Sign in only for now) */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Enter your password"
              disabled={loading}
            />

            {mode === 'signin' ? (
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  onClick={() => {
                    setShowForgotPassword((v) => !v)
                    setMessage('')
                    setMessageKind('info')
                  }}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
            ) : null}
          </div>

          {mode === 'signin' && showForgotPassword ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-900">Reset your password</div>
              <div className="mt-1 text-sm text-gray-600">
                We’ll email you a reset link to set a new password.
              </div>

              <div className="mt-3">
                <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>

              <button
                type="button"
                disabled={!String(email || '').trim() || loading}
                className={`mt-3 w-full py-2 px-4 rounded-md font-medium ${
                  !String(email || '').trim() || loading
                    ? 'bg-gray-300 text-white cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } transition-colors`}
                title="Send a password reset email"
                onClick={() => void handleRequestPasswordReset()}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </div>
          ) : null}

          {mode === 'signup' ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              After you confirm your email and sign in, you’ll be asked to enter your baseline measurements on the onboarding page.
            </div>
          ) : null}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md font-medium ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white transition-colors`}
          >
            {loading ? (mode === 'signin' ? 'Signing in...' : 'Creating account...') : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

        </form>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {mode === 'signin'
              ? 'Login credentials provided by Dr. Nick'
              : 'We’ll ask for baseline measurements after you confirm your email and sign in.'}
          </p>
        </div>

      </div>
    </div>
  )
}