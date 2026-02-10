import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Resp =
  | { success: true; complete: boolean; missing: { week0: boolean; unitSystem: boolean; height: boolean } }
  | { success: false; error: string }

function getAuthedAnonClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    if (!token) return NextResponse.json({ success: false, error: 'Missing Authorization bearer token' } satisfies Resp, { status: 401 })

    const supabase = getAuthedAnonClient(token)

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 })
    }

    const userId = userData.user.id

    const [{ data: profile, error: profileErr }, { data: week0Rows, error: week0Err }] = await Promise.all([
      supabase.from('profiles').select('unit_system, height').eq('id', userId).maybeSingle(),
      supabase.from('health_data').select('id').eq('user_id', userId).eq('week_number', 0).limit(1),
    ])

    if (profileErr) return NextResponse.json({ success: false, error: profileErr.message } satisfies Resp, { status: 500 })
    if (week0Err) return NextResponse.json({ success: false, error: week0Err.message } satisfies Resp, { status: 500 })

    const missingWeek0 = !(Array.isArray(week0Rows) && week0Rows.length > 0)
    const missingUnitSystem = !String((profile as any)?.unit_system || '').trim()
    const missingHeight = !Number((profile as any)?.height || 0)

    const complete = !missingWeek0 && !missingUnitSystem && !missingHeight

    return NextResponse.json(
      { success: true, complete, missing: { week0: missingWeek0, unitSystem: missingUnitSystem, height: missingHeight } } satisfies Resp,
      { status: 200 },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' } satisfies Resp, { status: 500 })
  }
}

