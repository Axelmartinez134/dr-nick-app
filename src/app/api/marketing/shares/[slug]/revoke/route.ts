import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = getSupabaseService()
    if (!supabase) {
      return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    }

    const { slug } = await params
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

    // Fetch the share row
    const { data: share, error: fetchErr } = await supabase
      .from('marketing_shares')
      .select('slug, patient_id, revoked_at, created_at')
      .eq('slug', slug)
      .single()

    if (fetchErr || !share) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let alreadyRevoked = !!share.revoked_at

    // Revoke if not already
    if (!alreadyRevoked) {
      const { error: revokeErr } = await supabase
        .from('marketing_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('slug', slug)

      if (revokeErr) {
        return NextResponse.json({ error: revokeErr.message || 'Failed to revoke' }, { status: 500 })
      }
    }

    // Compute fallback slug (latest non‑revoked for same patient)
    const { data: fallback, error: fbErr } = await supabase
      .from('marketing_shares')
      .select('slug')
      .eq('patient_id', share.patient_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fbErr) {
      // Fallback fetch issues shouldn't block the revoke; report error
      return NextResponse.json({ error: fbErr.message || 'Fallback query failed' }, { status: 500 })
    }

    let aliasUpdated = false
    let newAliasSlug: string | undefined

    if (fallback && fallback.slug) {
      // Update any aliases currently pointing at this slug to the fallback slug
      const { data: aliases } = await supabase
        .from('marketing_aliases')
        .select('alias')
        .eq('current_slug', slug)

      if (aliases && aliases.length > 0) {
        const { error: updErr } = await supabase
          .from('marketing_aliases')
          .update({ current_slug: fallback.slug })
          .eq('current_slug', slug)

        if (updErr) {
          return NextResponse.json({ error: updErr.message || 'Failed to update alias fallback' }, { status: 500 })
        }
        aliasUpdated = true
        newAliasSlug = fallback.slug
      }
    }

    return NextResponse.json({
      status: 'revoked',
      slug,
      alreadyRevoked,
      aliasUpdated,
      newAliasSlug
    }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


