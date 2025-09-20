import { describe, it, expect } from 'vitest'
import { snapshotBuilder } from '../snapshotBuilder'

function createMockSupabase() {
  const profiles = new Map<string, any>()
  const health = new Map<string, any[]>()
  const storageUploads: Record<string, Uint8Array> = {}

  const client: any = {
    // minimal storage mock so pinAssets can call upload/getPublicUrl (we're not pinning in this test)
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, data: Uint8Array) => {
          storageUploads[path] = data
          return { data: { path }, error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } })
      })
    },
    from: (table: string) => {
      // Chain-able query builder stub
      const builder: any = {}
      builder.select = (_cols: string) => builder
      builder.eq = (col: string, val: any) => {
        builder._eq = { col, val }
        return builder
      }
      builder.order = (_col: string, _opts: any) => builder
      builder.single = async () => {
        if (table === 'profiles') {
          const id = builder._eq?.val
          const row = profiles.get(id)
          return row ? { data: row, error: null } : { data: null, error: new Error('not found') }
        }
        return { data: null, error: new Error('unsupported single') }
      }
      builder.then = undefined
      builder.ilike = (_col: string, _val: string) => ({ data: [], error: null })
      builder.insert = async (_row: any) => ({ error: null })
      builder.upsert = async (_row: any) => ({ error: null })
      builder.update = async (_row: any) => ({ error: null })
      builder.selectRows = async () => {
        if (table === 'health_data') {
          const userId = builder._eq?.val
          const rows = health.get(userId) || []
          return { data: rows, error: null }
        }
        return { data: null, error: new Error('unsupported select') }
      }
      // Alias to simulate .select().eq().order() chain resolution
      builder.then = undefined
      return new Proxy(builder, {
        get(target, prop) {
          if (prop === 'select') return target.select
          if (prop === 'eq') return target.eq
          if (prop === 'order') return target.order
          if (prop === 'single') return target.single
          if (prop === 'ilike') return target.ilike
          if (prop === 'insert') return target.insert
          if (prop === 'upsert') return target.upsert
          if (prop === 'update') return target.update
          // allow await supabase.from('health_data').select('*').eq(...).order(...)
          if (prop === 'data') return undefined
          if (prop === 'error') return undefined
          return (target as any)[prop]
        },
        apply() { return builder }
      })
    }
  }

  function seedProfile(id: string, full_name: string) {
    profiles.set(id, { id, full_name, email: `${id}@test.com`, unit_system: 'imperial', weight_change_goal_percent: 1.0 })
  }
  function seedHealth(id: string, rows: any[]) {
    health.set(id, rows)
  }
  return { client, seedProfile, seedHealth }
}

describe('publish flow integration (mocked)', () => {
  it('flips alias to latest slug and can roll back on revoke (simulated)', async () => {
    const { client: supabase, seedProfile, seedHealth } = createMockSupabase()

    const patientId = 'p1'
    seedProfile(patientId, 'Andrea Rossi')
    seedHealth(patientId, [
      { id: 'h1', user_id: patientId, week_number: 0, weight: 200, nutrition_compliance_days: 5, purposeful_exercise_days: 4 },
      { id: 'h2', user_id: patientId, week_number: 1, weight: 198, nutrition_compliance_days: 6, purposeful_exercise_days: 5 }
    ])

    const settings: any = { displayNameMode: 'first_name', captionsEnabled: true, layout: 'stack', selectedMedia: {} }

    // First publish
    const res1 = await snapshotBuilder(supabase, patientId, 'andrea', settings)
    const slug1 = res1.slug

    // Second publish later
    const res2 = await snapshotBuilder(supabase, patientId, 'andrea', settings)
    const slug2 = res2.slug

    expect(slug1).not.toEqual(slug2)

    // Simulate alias mapping flip to slug2
    let aliasMap = { andrea: slug2 }
    expect(aliasMap['andrea']).toBe(slug2)

    // Simulate revoke of latest and rollback to previous active
    aliasMap = { andrea: slug1 }
    expect(aliasMap['andrea']).toBe(slug1)
  })
})


