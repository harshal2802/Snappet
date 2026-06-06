import { describe, it, expect } from 'vitest'
import { validateCatalog } from '../validate'
import { buildSourceDb } from './helpers'

describe('validateCatalog (KilterCatalogValidator parity)', () => {
  it('accepts a well-formed catalog', async () => {
    const { db } = await buildSourceDb()
    const res = validateCatalog(db, 50_000)
    expect(res.ok).toBe(true)
    expect(res.errors).toEqual([])
    expect(res.listedCount).toBe(3)
    expect(res.climbCount).toBe(4)
    db.close()
  })

  it('rejects a missing required table', async () => {
    const { db } = await buildSourceDb()
    db.run('DROP TABLE leds')
    const res = validateCatalog(db, 50_000)
    expect(res.ok).toBe(false)
    expect(res.errors.join(' ')).toContain('leds')
    db.close()
  })

  it('rejects a catalog with no listed climbs', async () => {
    const { db } = await buildSourceDb()
    db.run('UPDATE climbs SET is_listed = 0')
    const res = validateCatalog(db, 50_000)
    expect(res.ok).toBe(false)
    expect(res.errors.join(' ')).toContain('listed')
    db.close()
  })

  it('rejects a file over the 512 MB cap', async () => {
    const { db } = await buildSourceDb()
    const res = validateCatalog(db, 513_000_000)
    expect(res.ok).toBe(false)
    expect(res.errors.join(' ')).toContain('512 MB')
    db.close()
  })
})
