import { describe, it, expect, vi, beforeEach } from 'vitest'

// Under test: GET /api/marketing/shares/[slug]
import { GET as getSnapshotBySlug } from '@/app/api/marketing/shares/[slug]/route'

type ShareRow = { snapshot_json: any; revoked_at: string | null; view_count: number }

// In-memory mock DB keyed by slug
const mockShares: Record<string, ShareRow | undefined> = {}

// Minimal query builder mock
function makeQueryBuilder(table: string) {
  const _table = table
  let _select = ''
  const _filters: Record<string, any> = {}
  return {
    select(sel: string) {
      _select = sel
      return this
    },
    eq(col: string, val: any) {
      _filters[col] = val
      return this
    },
    async single() {
      if (_table === 'marketing_shares') {
        const slug = _filters['slug']
        const row = mockShares[String(slug)]
        if (!row) return { data: null, error: { message: 'not found' } }
        return { data: row, error: null }
      }
      return { data: null, error: { message: 'unsupported table' } }
    },
    // update for view_count increment
    update(values: any) {
      return {
        eq(col: string, val: any) {
          if (_table === 'marketing_shares' && col === 'slug') {
            const slug = String(val)
            const row = mockShares[slug]
            if (row && typeof values?.view_count === 'number') {
              row.view_count = values.view_count
            }
          }
          return Promise.resolve({ data: null, error: null })
        }
      }
    }
  }
}

// Mock supabase client factory
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      return {
        from(table: string) {
          return makeQueryBuilder(table)
        }
      }
    })
  }
})

describe('GET /api/marketing/shares/[slug]', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockShares)) delete mockShares[k]
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'testkey'
  })

  it('returns 200 with snapshot JSON and increments view_count', async () => {
    mockShares['andrea-123'] = { snapshot_json: { hello: 'world' }, revoked_at: null, view_count: 2 }

    const res = await getSnapshotBySlug(new Request('http://localhost'), { params: { slug: 'andrea-123' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ hello: 'world' })
    // Ensure counter incremented in mock store
    expect(mockShares['andrea-123']!.view_count).toBe(3)
    // Cache headers present
    expect(res.headers.get('Cache-Control')).toBeTruthy()
  })

  it('returns 410 for revoked snapshot', async () => {
    mockShares['revoked-1'] = { snapshot_json: { ok: false }, revoked_at: new Date().toISOString(), view_count: 0 }
    const res = await getSnapshotBySlug(new Request('http://localhost'), { params: { slug: 'revoked-1' } } as any)
    expect(res.status).toBe(410)
  })

  it('returns 404 when not found', async () => {
    const res = await getSnapshotBySlug(new Request('http://localhost'), { params: { slug: 'missing' } } as any)
    expect(res.status).toBe(404)
  })
})


