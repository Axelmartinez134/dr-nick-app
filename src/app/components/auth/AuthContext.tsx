// src/components/auth/AuthContext.tsx
// This manages the authentication state for your entire app

'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { User, Session, AuthError } from '@supabase/supabase-js'

// Your Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// TypeScript interface for auth response
interface AuthResponse {
  data: {
    user: User | null
    session: Session | null
  } | null
  error: AuthError | null
}

// TypeScript interface for what our context provides
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isDoctor: boolean
  isPatient: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResponse>
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signOut: () => Promise<void>
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Props for AuthProvider component
interface AuthProviderProps {
  children: ReactNode
}

// AuthProvider component that wraps your entire app
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Role detection based on email
  const isDoctor = !!(user?.email && process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL)
  const isPatient = !!user && !isDoctor

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Sign up function
  const signUp = async (email: string, password: string, fullName?: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })
      return { data, error }
    } catch (err) {
      return { data: null, error: err as AuthError }
    }
  }

  // Sign in function
  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { data, error }
    } catch (err) {
      return { data: null, error: err as AuthError }
    }
  }

  // Sign out function with 403 error handling
  const signOut = async () => {
    try {
      // Strategy 1: Try normal logout first
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.warn('Normal logout failed:', error)
        
        // Strategy 2: Try logout without global scope
        try {
          const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
          if (localError) {
            throw localError
          }
        } catch (localLogoutError) {
          console.warn('Local logout also failed:', localLogoutError)
          throw localLogoutError
        }
      }
      
      console.log('Logout successful')
      
    } catch (error) {
      console.error('All logout strategies failed:', error)
      
      // Strategy 3: Manual session clearing as fallback
      console.log('Forcing manual logout...')
      
      // Clear all possible storage locations
      try {
        localStorage.removeItem('supabase.auth.token')
        localStorage.removeItem('sb-pobkamvdnbxhmyfwbnsj-auth-token')
        sessionStorage.clear()
        
        // Clear any cookies
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        })
      } catch (storageError) {
        console.warn('Storage clearing failed:', storageError)
      }
    }
    
    // Always force clear auth state regardless of API success/failure
    setSession(null)
    setUser(null)
    setLoading(false)
    
    // Force page refresh to ensure clean state
    window.location.href = '/'
  }

  const value = {
    user,
    session,
    loading,
    isDoctor,
    isPatient,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}