// src/components/auth/AuthContext.tsx
// This manages the authentication state for your entire app

'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
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
  const gapFillTriggeredRef = useRef(false)
  const pastRedirectTriggeredRef = useRef(false)

  // Role detection based on email
  const isDoctor = !!(user?.email && process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL)
  const isPatient = !!user && !isDoctor

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user && !gapFillTriggeredRef.current) {
        gapFillTriggeredRef.current = true
        void gapFillMissedWeeks(session.user)
      }

      // Redirect Past patients to /inactive (admins exempt)
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
      const isDoctorEmail = !!(session?.user?.email && adminEmail && session.user.email === adminEmail)
      if (session?.user && !isDoctorEmail && !pastRedirectTriggeredRef.current) {
        ;(async () => {
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('client_status')
              .eq('id', session.user!.id)
              .single()
            if (!error && profile?.client_status === 'Past') {
              pastRedirectTriggeredRef.current = true
              if (window.location.pathname !== '/inactive') {
                window.location.href = '/inactive'
              }
            }
          } catch {
            // no-op
          }
        })()
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user && !gapFillTriggeredRef.current) {
        gapFillTriggeredRef.current = true
        void gapFillMissedWeeks(session.user)
      }

      // Redirect Past patients to /inactive (admins exempt)
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
      const isDoctorEmail = !!(session?.user?.email && adminEmail && session.user.email === adminEmail)
      if (session?.user && !isDoctorEmail && !pastRedirectTriggeredRef.current) {
        ;(async () => {
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('client_status')
              .eq('id', session.user!.id)
              .single()
            if (!error && profile?.client_status === 'Past') {
              pastRedirectTriggeredRef.current = true
              if (window.location.pathname !== '/inactive') {
                window.location.href = '/inactive'
              }
            }
          } catch {
            // no-op
          }
        })()
      }
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

// =============================
// Background gap-fill utilities
// =============================

/**
 * Convert a Date to the "Anywhere on Earth" timeline by shifting time to UTC+14.
 */
function toAoE(date: Date): Date {
  const firstMondayOffsetMinutes = 14 * 60 // UTC+14
  return new Date(date.getTime() + firstMondayOffsetMinutes * 60000)
}

/**
 * Get the AoE Monday (00:00) for the provided Date in AoE timeline.
 */
function getAoEMonday(date: Date): Date {
  const aoe = toAoE(date)
  const dayOfWeek = aoe.getDay() // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(aoe)
  monday.setDate(aoe.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for an AoE Monday plus N weeks.
 */
function aoeMondayPlusWeeksIso(monday: Date, weeksToAdd: number): string {
  const d = new Date(monday)
  d.setDate(d.getDate() + weeksToAdd * 7)
  // Convert back from AoE to UTC date component for storage
  // We want the calendar date corresponding to that AoE Monday (local AoE date)
  // Using toISOString and splitting is acceptable as we only store YYYY-MM-DD
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate current AoE calendar week number given the AoE Monday of Week 1.
 * Week 1's Monday maps to week number 1. Each subsequent AoE Monday increments by 1.
 */
function calculateAoECurrentWeek(week1AoEMonday: Date): number {
  const nowAoEMonday = getAoEMonday(new Date())
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const diffMs = nowAoEMonday.getTime() - week1AoEMonday.getTime()
  const weeksElapsed = Math.floor(diffMs / msPerWeek)
  return weeksElapsed + 1 // Week 1 baseline
}

/**
  * Background routine to auto-create missed weeks as null rows for Current or Test clients
  * who have at least one Week 1 submission entered by the patient.
 */
async function gapFillMissedWeeks(user: User): Promise<void> {
  try {
    // 1) Ensure profile is Current or Test
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('client_status')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.warn('gapFillMissedWeeks: failed to load profile', profileError)
      return
    }
    if (!profile || (profile.client_status !== 'Current' && profile.client_status !== 'Test')) {
      return // Only run for Current or Test clients
    }

    // 2) Find the first Week 1 patient-submitted record
    const { data: week1Rows, error: week1Error } = await supabase
      .from('health_data')
      .select('date, created_at')
      .eq('user_id', user.id)
      .eq('week_number', 1)
      .eq('data_entered_by', 'patient')
      .order('created_at', { ascending: true })
      .limit(1)

    if (week1Error) {
      console.warn('gapFillMissedWeeks: failed to load week 1', week1Error)
      return
    }
    if (!week1Rows || week1Rows.length === 0) {
      return // Require at least one Week 1 patient submission to start program
    }

    // Program start is AoE Monday of the calendar week containing first Week 1 submission
    const week1SubmissionDate = new Date(week1Rows[0].date)
    const week1AoEMonday = getAoEMonday(week1SubmissionDate)

    // 3) Determine current AoE week number since Week 1
    const currentWeek = calculateAoECurrentWeek(week1AoEMonday)
    if (currentWeek <= 1) return

    // 4) Load all existing weeks for this user
    const { data: existingRows, error: existingError } = await supabase
      .from('health_data')
      .select('week_number')
      .eq('user_id', user.id)

    if (existingError) {
      console.warn('gapFillMissedWeeks: failed to load existing rows', existingError)
      return
    }

    const existingWeeks = new Set<number>((existingRows || []).map(r => r.week_number))

    // 5) For each missing week < currentWeek, create a null row if it does not exist
    //    Windows are considered closed once we have advanced to a later AoE Monday
    for (let w = 1; w < currentWeek; w++) {
      if (existingWeeks.has(w)) continue
      try {
        // Re-check existence just-in-time to prevent duplicates in concurrent scenarios
        const { data: precheck, error: precheckError } = await supabase
          .from('health_data')
          .select('id')
          .eq('user_id', user.id)
          .eq('week_number', w)
          .limit(1)
        if (precheckError) {
          console.warn('gapFillMissedWeeks: pre-insert check failed', { week: w, error: precheckError })
        }
        if (precheck && precheck.length > 0) {
          existingWeeks.add(w)
          continue
        }

        const aoeMondayIso = aoeMondayPlusWeeksIso(week1AoEMonday, w - 1)
        const insertPayload: any = {
          user_id: user.id,
          week_number: w,
          date: aoeMondayIso,
          data_entered_by: 'system',
          needs_review: true,
          notes: `AUTO-CREATED: Missed check-in for week ${w}`
        }
        const { error: insertError } = await supabase
          .from('health_data')
          .insert(insertPayload)
        if (insertError) {
          console.warn('gapFillMissedWeeks: insert failed', { week: w, error: insertError })
        } else {
          existingWeeks.add(w)
        }
      } catch (e) {
        console.warn('gapFillMissedWeeks: exception during insert', { week: w, error: e })
      }
    }
  } catch (err) {
    console.warn('gapFillMissedWeeks: unexpected error', err)
  }
}