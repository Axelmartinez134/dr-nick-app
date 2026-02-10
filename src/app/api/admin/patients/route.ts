import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PatientRow = {
  id: string
  email: string
  full_name: string | null
  client_status: string | null
  created_at: string
  patient_password: string | null
  unit_system: string | null
  height: number | null
}

type PatientRespRow = PatientRow & {
  onboarding_complete: boolean
  onboarding_missing: { week0: boolean; unitSystem: boolean; height: boolean }
}

type Resp =
  | { success: true; patients: PatientRespRow[] }
  | { success: false; error: string }

function getAnonClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    if (!token) return NextResponse.json({ success: false, error: 'Missing Authorization bearer token' } satisfies Resp, { status: 401 })

    // Ensure caller is Dr. Nick (admin email)
    const anon = getAnonClient(token)
    const { data: userData, error: userErr } = await anon.auth.getUser()
    if (userErr || !userData?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 })
    }
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!adminEmail || String(userData.user.email).toLowerCase() !== String(adminEmail).toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 })
    }

    const svc = getServiceClient()

    const { data: profiles, error: profErr } = await svc
      .from('profiles')
      .select('id,email,full_name,client_status,created_at,patient_password,unit_system,height')
      .order('created_at', { ascending: false })

    if (profErr) {
      return NextResponse.json({ success: false, error: profErr.message } satisfies Resp, { status: 500 })
    }

    const base = (profiles || []) as PatientRow[]
    if (base.length === 0) {
      return NextResponse.json({ success: true, patients: [] } satisfies Resp, { status: 200 })
    }

    const ids = base.map((p) => p.id)
    const { data: week0Rows, error: week0Err } = await svc
      .from('health_data')
      .select('user_id')
      .in('user_id', ids)
      .eq('week_number', 0)

    if (week0Err) {
      return NextResponse.json({ success: false, error: week0Err.message } satisfies Resp, { status: 500 })
    }

    const week0Set = new Set<string>((week0Rows || []).map((r: any) => String(r.user_id)))

    const patients: PatientRespRow[] = base.map((p) => {
      const hasWeek0 = week0Set.has(String(p.id))
      const hasUnit = !!String(p.unit_system || '').trim()
      const hasHeight = Number(p.height || 0) > 0
      const missing = { week0: !hasWeek0, unitSystem: !hasUnit, height: !hasHeight }
      const onboarding_complete = hasWeek0 && hasUnit && hasHeight
      return { ...p, onboarding_complete, onboarding_missing: missing }
    })

    return NextResponse.json({ success: true, patients } satisfies Resp, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' } satisfies Resp, { status: 500 })
  }
}

