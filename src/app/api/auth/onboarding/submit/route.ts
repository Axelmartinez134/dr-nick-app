import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Resp =
  | { success: true; complete: true }
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

function toTwo(n: number | null): number | null {
  if (n === null) return null
  return Math.round(n * 100) / 100
}
function kgToLbs(kg: number | null): number | null {
  if (kg === null) return null
  return kg / 0.45359237
}
function cmToIn(cm: number | null): number | null {
  if (cm === null) return null
  return cm / 2.54
}
function parsePositiveNumber(v: any): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '').trim())
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return n
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    if (!token) return NextResponse.json({ success: false, error: 'Missing Authorization bearer token' } satisfies Resp, { status: 401 })

    const body = await request.json()
    const unitSystem = body?.unitSystem === 'metric' ? 'metric' : body?.unitSystem === 'imperial' ? 'imperial' : null
    const trackBloodPressure = body?.trackBloodPressure

    const startingWeightRaw = parsePositiveNumber(body?.startingWeight)
    const startingWaistRaw = parsePositiveNumber(body?.startingWaist)
    const heightRaw = parsePositiveNumber(body?.height)

    if (!unitSystem) return NextResponse.json({ success: false, error: 'Measurement system is required' } satisfies Resp, { status: 400 })
    if (typeof trackBloodPressure !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Track Blood Pressure is required' } satisfies Resp, { status: 400 })
    }
    if (startingWeightRaw === null) return NextResponse.json({ success: false, error: 'Starting weight is required' } satisfies Resp, { status: 400 })
    if (startingWaistRaw === null) return NextResponse.json({ success: false, error: 'Starting waist is required' } satisfies Resp, { status: 400 })
    if (heightRaw === null) return NextResponse.json({ success: false, error: 'Height is required' } satisfies Resp, { status: 400 })

    const supabase = getAuthedAnonClient(token)
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 })
    }
    const userId = userData.user.id

    const isMetric = unitSystem === 'metric'
    const weightLbs = toTwo(isMetric ? kgToLbs(startingWeightRaw) : startingWeightRaw)
    const waistInches = toTwo(isMetric ? cmToIn(startingWaistRaw) : startingWaistRaw)
    const heightInches = toTwo(isMetric ? cmToIn(heightRaw) : heightRaw)

    // Update required profile fields
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        unit_system: unitSystem,
        height: heightInches,
        track_blood_pressure: Boolean(trackBloodPressure),
      })
      .eq('id', userId)

    if (profileErr) return NextResponse.json({ success: false, error: profileErr.message } satisfies Resp, { status: 500 })

    // Upsert Week 0 baseline
    const today = new Date().toISOString().split('T')[0]
    const { data: week0Rows, error: week0Err } = await supabase
      .from('health_data')
      .select('id')
      .eq('user_id', userId)
      .eq('week_number', 0)
      .limit(1)

    if (week0Err) return NextResponse.json({ success: false, error: week0Err.message } satisfies Resp, { status: 500 })

    if (Array.isArray(week0Rows) && week0Rows.length > 0) {
      const { error: updErr } = await supabase
        .from('health_data')
        .update({
          date: today,
          weight: weightLbs,
          waist: waistInches,
          initial_weight: weightLbs,
          data_entered_by: 'patient',
          needs_review: false,
        })
        .eq('id', week0Rows[0].id)
      if (updErr) return NextResponse.json({ success: false, error: updErr.message } satisfies Resp, { status: 500 })
    } else {
      const { error: insErr } = await supabase
        .from('health_data')
        .insert({
          user_id: userId,
          date: today,
          week_number: 0,
          weight: weightLbs,
          waist: waistInches,
          initial_weight: weightLbs,
          data_entered_by: 'patient',
          needs_review: false,
        })
      if (insErr) return NextResponse.json({ success: false, error: insErr.message } satisfies Resp, { status: 500 })
    }

    return NextResponse.json({ success: true, complete: true } satisfies Resp, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' } satisfies Resp, { status: 500 })
  }
}

