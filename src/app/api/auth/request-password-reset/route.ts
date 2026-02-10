import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Resp = { success: true; message: string } | { success: false; error: string }

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      return NextResponse.json({ success: false, error: 'Email is required' } satisfies Resp, { status: 400 })
    }

    const supabase = getAnonClient()
    const url = new URL(request.url)
    const redirectTo = `${url.origin}/reset-password`

    // Always return 200 on success path to avoid email enumeration.
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
    if (error) {
      // Still return a generic success response unless it's clearly a validation issue.
      // This keeps behavior consistent and avoids leaking account existence.
      return NextResponse.json(
        { success: true, message: 'If an account exists, a reset email has been sent.' } satisfies Resp,
        { status: 200 },
      )
    }

    return NextResponse.json(
      { success: true, message: 'If an account exists, a reset email has been sent.' } satisfies Resp,
      { status: 200 },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' } satisfies Resp, { status: 500 })
  }
}

