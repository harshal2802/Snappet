import { describe, it, expect } from 'vitest'
import { buildFilteredDb } from '../exportDb'
import { REQUIRED_TABLES } from '../schema'
import { DEFAULT_FILTER } from '../types'
import type { FilterState } from '../types'
import { buildSourceDb, getSQL } from './helpers'

const f = (over: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTER, ...over })

function climbUuids(SQL: Awaited<ReturnType<typeof getSQL>>, bytes: Uint8Array): string[] {
  const out = new SQL.Database(bytes)
  const res = out.exec('SELECT uuid FROM climbs ORDER BY uuid')
  const uuids = res.length ? res[0].values.map((r) => String(r[0])) : []
  out.close()
  return uuids
}

describe('buildFilteredDb', () => {
  it('produces a valid, importable catalog with every required table', async () => {
    const { SQL, db } = await buildSourceDb()
    const { bytes, validation } = buildFilteredDb(SQL, db, DEFAULT_FILTER)
    expect(validation.ok).toBe(true)

    const out = new SQL.Database(bytes)
    const names = new Set(
      out.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.map((r) => String(r[0])),
    )
    for (const t of REQUIRED_TABLES) expect(names.has(t)).toBe(true)
    out.close()
    db.close()
  })

  it('subsets climbs to the filter (name match)', async () => {
    const { SQL, db } = await buildSourceDb()
    const { bytes } = buildFilteredDb(SQL, db, f({ name: 'crimp' }))
    expect(climbUuids(SQL, bytes)).toEqual(['U1'])
    db.close()
  })

  it('copies reference tables whole (difficulty_grades intact)', async () => {
    const { SQL, db } = await buildSourceDb()
    const { bytes } = buildFilteredDb(SQL, db, f({ name: 'crimp' }))
    const out = new SQL.Database(bytes)
    const n = Number(out.exec('SELECT COUNT(*) FROM difficulty_grades')[0].values[0][0])
    expect(n).toBe(3)
    out.close()
    db.close()
  })

  it('mobile-compatible mode keeps only single-frame, listed climbs on layouts 1 & 8', async () => {
    const { SQL, db } = await buildSourceDb()
    // No layout filter → mobile mode restricts to [1,8]; excludes the multi-frame U3.
    const { bytes, validation } = buildFilteredDb(SQL, db, DEFAULT_FILTER, { mobileCompatible: true })
    expect(validation.ok).toBe(true)
    const uuids = climbUuids(SQL, bytes)
    expect(uuids).toContain('U1')
    expect(uuids).toContain('U2')
    expect(uuids).not.toContain('U3') // multi-frame
    expect(uuids).not.toContain('U4') // draft
    db.close()
  })
})
