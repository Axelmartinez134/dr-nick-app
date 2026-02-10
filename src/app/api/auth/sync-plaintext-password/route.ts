import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Resp = { success: true } | { success: false; error: string }

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase anon env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing Authorization bearer token' } satisfies Resp, { status: 401 })
    }

    const { password } = await request.json()
    const newPassword = String(password || '')
    if (!newPassword) {
      return NextResponse.json({ success: false, error: 'Password is required' } satisfies Resp, { status: 400 })
    }

    // Validate the token is a real user session.
    const anon = getAnonClient()
    const { data: userData, error: userErr } = await anon.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 })
    }

    const svc = getServiceClient()
    const { error: updErr } = await svc
      .from('profiles')
      .update({ patient_password: newPassword })
      .eq('id', userData.user.id)

    if (updErr) {
      return NextResponse.json({ success: false, error: updErr.message } satisfies Resp, { status: 500 })
    }

    return NextResponse.json({ success: true } satisfies Resp, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' } satisfies Resp, { status: 500 })
  }
}

