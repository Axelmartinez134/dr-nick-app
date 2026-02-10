import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Resp =
  | { success: true; message: string }
  | { success: false; error: string }

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const fullName = String(body?.fullName || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')

    if (!fullName) return NextResponse.json({ success: false, error: 'Full name is required' } satisfies Resp, { status: 400 })
    if (!email) return NextResponse.json({ success: false, error: 'Email is required' } satisfies Resp, { status: 400 })
    if (!password) return NextResponse.json({ success: false, error: 'Password is required' } satisfies Resp, { status: 400 })
    if (password.length < 8) return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' } satisfies Resp, { status: 400 })

    const anon = getAnonClient()
    const url = new URL(request.url)
    const emailRedirectTo = `${url.origin}/`

    const { data: signupData, error: signupError } = await anon.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
        },
      },
    })

    if (signupError) {
      const msg = signupError.message || 'Failed to create account'
      const lower = msg.toLowerCase()
      if (lower.includes('already registered') || lower.includes('already exists')) {
        return NextResponse.json({ success: false, error: 'Email already exists' } satisfies Resp, { status: 409 })
      }
      return NextResponse.json({ success: false, error: msg } satisfies Resp, { status: 400 })
    }

    const userId = signupData?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Failed to create user account' } satisfies Resp, { status: 500 })
    }

    const svc = getServiceClient()

    // Create or update profile immediately so Dr. Nick can see it right away.
    const { error: profileError } = await svc
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          patient_password: password, // explicit requirement (plaintext)
          client_status: 'Nutraceutical',
        },
        { onConflict: 'id' },
      )

    if (profileError) {
      return NextResponse.json({ success: false, error: `Failed to create profile: ${profileError.message}` } satisfies Resp, { status: 500 })
    }

    return NextResponse.json(
      { success: true, message: 'Check your email to confirm your account.' } satisfies Resp,
      { status: 200 },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' } satisfies Resp, { status: 500 })
  }
}

