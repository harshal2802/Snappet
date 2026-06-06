import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { buildListingSql, buildCountSql } from '../query'
import { buildFilteredDb } from '../exportDb'
import { validateCatalog } from '../validate'
import { DEFAULT_FILTER } from '../types'
import { getSQL } from './helpers'

// Drives the REAL generated snapshot (public/board-data/kilter.sqlite.gz) through
// the same query + export code the worker runs — proving the data path end-to-end
// without a browser. If the fixture is regenerated this stays valid.
const FIXTURE = resolve(process.cwd(), 'public/board-data/kilter.sqlite.gz')

describe('kilter fixture (real snapshot) integration', () => {
  it('loads, validates, queries, and exports a filtered importable catalog', async () => {
    const SQL = await getSQL()
    const bytes = gunzipSync(readFileSync(FIXTURE))
    const db = new SQL.Database(new Uint8Array(bytes))

    // Validates as an importable catalog.
    expect(validateCatalog(db, bytes.length).ok).toBe(true)

    // Listing returns rows; count is consistent.
    const { sql, params } = buildListingSql(DEFAULT_FILTER, 10, 0)
    const rows = db.exec(sql, params)
    expect(rows[0].values.length).toBeGreaterThan(0)
    const cnt = buildCountSql(DEFAULT_FILTER)
    const total = Number(db.exec(cnt.sql, cnt.params)[0].values[0][0])
    expect(total).toBeGreaterThanOrEqual(rows[0].values.length)

    // Mobile-compatible export of a grade-filtered slice is valid + a strict subset.
    const { bytes: out, validation } = buildFilteredDb(
      SQL,
      db,
      { ...DEFAULT_FILTER, gradeMin: 16 },
      { mobileCompatible: true },
    )
    expect(validation.ok).toBe(true)
    expect(validation.listedCount).toBeGreaterThan(0)
    expect(validation.listedCount).toBeLessThanOrEqual(total)

    const exported = new SQL.Database(out)
    // Every exported climb is single-frame and on a mobile layout (1 or 8).
    const bad = exported.exec(
      'SELECT COUNT(*) FROM climbs WHERE frames_count <> 1 OR layout_id NOT IN (1,8)',
    )[0].values[0][0]
    expect(Number(bad)).toBe(0)
    exported.close()
    db.close()
  })
})
