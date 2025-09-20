// Alias and slug helpers for Marketing Links

const ALIAS_REGEX = /^[a-z0-9-]+$/

export function sanitizeAlias(input: string): string {
  const lower = (input || '').toLowerCase().trim()
  // Replace whitespace/underscores with hyphens, drop invalid chars, collapse hyphens
  const replaced = lower.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '-')
  return replaced.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function isAliasValidFormat(alias: string): boolean {
  return !!alias && ALIAS_REGEX.test(alias)
}

// Case-insensitive uniqueness check using ilike
export async function validateAliasAvailable(supabase: any, alias: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase
    .from('marketing_aliases')
    .select('alias')
    .ilike('alias', alias)

  if (error) return { ok: false, reason: error.message }
  if (Array.isArray(data) && data.length > 0) return { ok: false, reason: 'Alias already taken' }
  return { ok: true }
}

// Generate anonymousN alias (anonymous1, anonymous2, ...)
export async function nextAnonymousAlias(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from('marketing_aliases')
    .select('alias')
    .ilike('alias', 'anonymous%')

  if (error || !data) return 'anonymous1'

  const nums = data
    .map((r: any) => {
      const m = String(r.alias || '').match(/^anonymous(\d+)$/)
      return m ? Number(m[1]) : 0
    })
    .filter((n: number) => Number.isFinite(n))

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `anonymous${next}`
}

// Build an immutable snapshot slug that is unique and human-friendly
export function makeSnapshotSlug(alias: string, d: Date = new Date()): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6)
  // Example: andrea-2025-09-20-ab12
  return `${alias}-${yyyy}-${mm}-${dd}-${rand}`
}


