import { describe, it, expect } from 'vitest'
import { buildConditions, buildListingSql, buildUuidSql, buildCountSql } from '../query'
import { DEFAULT_FILTER } from '../types'
import type { FilterState } from '../types'

const f = (over: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTER, ...over })

describe('buildConditions', () => {
  it('defaults to listed-only', () => {
    const { sql, params } = buildConditions(DEFAULT_FILTER)
    expect(sql).toBe('c.is_listed = 1')
    expect(params).toEqual([])
  })

  it('drops the is_listed clause when listedOnly is false', () => {
    const { sql } = buildConditions(f({ listedOnly: false }))
    expect(sql).toBe('1=1')
  })

  it('binds every active filter as a parameter (no interpolation)', () => {
    const { sql, params } = buildConditions(
      f({
        layoutId: 1,
        angle: 40,
        gradeMin: 13,
        gradeMax: 19,
        minAscents: 50,
        minQuality: 3,
        setter: 'asana',
        name: 'crimp',
        benchmarkOnly: true,
        singleFrameOnly: true,
      }),
    )
    expect(sql).toContain('c.layout_id = ?')
    expect(sql).toContain('cs.angle = ?')
    expect(sql).toContain('ROUND(cs.display_difficulty) >= ?')
    expect(sql).toContain('ROUND(cs.display_difficulty) <= ?')
    expect(sql).toContain('cs.ascensionist_count >= ?')
    expect(sql).toContain('cs.quality_average >= ?')
    expect(sql).toContain('c.setter_username LIKE ?')
    expect(sql).toContain('c.name LIKE ?')
    expect(sql).toContain('cs.benchmark_difficulty IS NOT NULL')
    expect(sql).toContain('c.frames_count = 1')
    expect(params).toEqual([1, 40, 13, 19, 50, 3, '%asana%', '%crimp%'])
  })

  it('supports a layoutIds IN list (used by mobile-compatible export)', () => {
    const { sql, params } = buildConditions(f({ layoutIds: [1, 8] }))
    expect(sql).toContain('c.layout_id IN (?,?)')
    expect(params).toEqual([1, 8])
  })
})

describe('listing / count / uuid SQL', () => {
  it('groups by climb and pages the listing', () => {
    const { sql, params } = buildListingSql(DEFAULT_FILTER, 50, 100)
    expect(sql).toContain('GROUP BY c.uuid')
    expect(sql).toContain('MAX(cs.ascensionist_count) AS ascents')
    expect(sql).toContain('ORDER BY ascents DESC')
    expect(sql.trimEnd().endsWith('LIMIT ? OFFSET ?')).toBe(true)
    expect(params.slice(-2)).toEqual([50, 100])
  })

  it('counts distinct climbs', () => {
    const { sql } = buildCountSql(DEFAULT_FILTER)
    expect(sql).toContain('COUNT(DISTINCT c.uuid)')
  })

  it('selects distinct uuids for export', () => {
    const { sql } = buildUuidSql(DEFAULT_FILTER)
    expect(sql).toContain('SELECT DISTINCT c.uuid')
  })
})
