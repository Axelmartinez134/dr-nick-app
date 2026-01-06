// src/components/auth/Login.tsx
// Login form for existing users

'use client'

import { useState } from 'react'
import { useAuth, supabase } from './AuthContext'

export default function Login() {
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Get signIn function from our auth context
  const { signIn } = useAuth()

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await signIn(email, password)

    if (error) {
      setMessage(error.message)
    } else {
      try {
        const userId = data?.user?.id
        if (userId) {
          // Editor users always route to /editor after login
          const { data: editorRow } = await supabase
            .from('editor_users')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle()
          if (editorRow?.user_id) {
            window.location.href = '/editor'
            setLoading(false)
            return
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('client_status')
            .eq('id', userId)
            .single()
          const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
          const isAdmin = !!(data?.user?.email && adminEmail && data.user.email === adminEmail)
          if (!isAdmin && profile?.client_status === 'Past') {
            if (window.location.pathname !== '/inactive') {
              window.location.href = '/inactive'
            }
            setLoading(false)
            return
          }
        }
      } catch {
        // ignore and continue
      }
      setMessage('Login successful! Redirecting...')
    }
    
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Welcome Back
        </h2>

        {/* Display messages (success/error) */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.includes('successful') 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
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

          {/* Password Input */}
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
          </div>

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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Login credentials provided by Dr. Nick
          </p>
        </div>

      </div>
    </div>
  )
}