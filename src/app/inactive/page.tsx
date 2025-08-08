'use client'

import { useEffect, useState } from 'react'
import { useAuth, supabase } from '../components/auth/AuthContext'

export default function InactivePage() {
  const { user, signOut } = useAuth()
  const [firstName, setFirstName] = useState<string>('there')

  useEffect(() => {
    let isMounted = true
    const loadName = async () => {
      try {
        if (!user?.id) return
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (!error) {
          const full = (data?.full_name || '').trim()
          const derived = full ? full.split(' ')[0] : 'there'
          if (isMounted) setFirstName(derived)
        }
      } catch {
        // ignore errors and keep fallback
      }
    }
    void loadName()
    return () => {
      isMounted = false
    }
  }, [user?.id])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white rounded-lg shadow-md p-8 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Paused</h1>
          <p className="text-gray-700">
            {firstName}, it’s been a privilege to support your health journey. Your current program has finished, so your account is paused for now. If you’d like continued access or a new phase, please contact Dr. Nick.
          </p>
        </div>
        <div>
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center px-5 py-2.5 rounded-md bg-gray-800 text-white hover:bg-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

