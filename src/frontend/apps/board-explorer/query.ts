// Pure SQL builders for the climbs catalogue. No sql.js runtime here — only the
// SqlValue type — so this module unit-tests in Node without a DB or WASM.
//
// The listing query mirrors snappet-mobile's KilterCatalog reader: join climbs to
// climb_stats and filter on board angle, grade, ascents, quality, setter, name,
// benchmark. A climb can have several climb_stats rows (one per angle); we collapse
// to one row per climb using SQLite's documented "bare columns follow the single
// MAX()" behaviour, so the row shown is the climb's most-climbed matching angle.

import type { SqlValue } from 'sql.js'
import type { FilterState, SortKey } from './types'

export interface BuiltSql {
  sql: string
  params: SqlValue[]
}

/**
 * The shared WHERE clause used by listing, count, and export-uuid resolution.
 * Conditions reference `c` (climbs) and `cs` (climb_stats). Returns `'1=1'` when
 * no filter is active so callers can always interpolate it safely.
 */
export function buildConditions(f: FilterState): BuiltSql {
  const conds: string[] = []
  const params: SqlValue[] = []

  if (f.listedOnly) conds.push('c.is_listed = 1')
  if (f.singleFrameOnly) conds.push('c.frames_count = 1')

  if (typeof f.layoutId === 'number') {
    conds.push('c.layout_id = ?')
    params.push(f.layoutId)
  } else if (f.layoutIds && f.layoutIds.length > 0) {
    conds.push(`c.layout_id IN (${f.layoutIds.map(() => '?').join(',')})`)
    params.push(...f.layoutIds)
  }

  if (typeof f.angle === 'number') {
    conds.push('cs.angle = ?')
    params.push(f.angle)
  }
  if (typeof f.gradeMin === 'number') {
    conds.push('ROUND(cs.display_difficulty) >= ?')
    params.push(f.gradeMin)
  }
  if (typeof f.gradeMax === 'number') {
    conds.push('ROUND(cs.display_difficulty) <= ?')
    params.push(f.gradeMax)
  }
  if (typeof f.minAscents === 'number') {
    conds.push('cs.ascensionist_count >= ?')
    params.push(f.minAscents)
  }
  if (typeof f.minQuality === 'number') {
    conds.push('cs.quality_average >= ?')
    params.push(f.minQuality)
  }
  if (f.setter.trim()) {
    conds.push('c.setter_username LIKE ?')
    params.push(`%${f.setter.trim()}%`)
  }
  if (f.name.trim()) {
    conds.push('c.name LIKE ?')
    params.push(`%${f.name.trim()}%`)
  }
  if (f.benchmarkOnly) conds.push('cs.benchmark_difficulty IS NOT NULL')

  return { sql: conds.length ? conds.join(' AND ') : '1=1', params }
}

const SORT_SQL: Record<SortKey, string> = {
  popularity: 'ascents DESC',
  quality: 'quality DESC, ascents DESC',
  'grade-asc': 'difficulty ASC, ascents DESC',
  'grade-desc': 'difficulty DESC, ascents DESC',
  name: 'name COLLATE NOCASE ASC',
}

const BASE_JOIN = 'FROM climbs c JOIN climb_stats cs ON cs.climb_uuid = c.uuid'

/** One row per matching climb (best matching angle), ordered + paged. */
export function buildListingSql(f: FilterState, limit: number, offset: number): BuiltSql {
  const { sql: where, params } = buildConditions(f)
  const sql =
    `SELECT c.uuid AS uuid, c.name AS name, c.setter_username AS setter, ` +
    `cs.angle AS angle, cs.display_difficulty AS difficulty, ` +
    `cs.quality_average AS quality, ` +
    `(cs.benchmark_difficulty IS NOT NULL) AS benchmark, ` +
    `MAX(cs.ascensionist_count) AS ascents ` +
    `${BASE_JOIN} WHERE ${where} GROUP BY c.uuid ` +
    `ORDER BY ${SORT_SQL[f.sort]} LIMIT ? OFFSET ?`
  return { sql, params: [...params, limit, offset] }
}

/** COUNT of distinct matching climbs. */
export function buildCountSql(f: FilterState): BuiltSql {
  const { sql: where, params } = buildConditions(f)
  return { sql: `SELECT COUNT(DISTINCT c.uuid) AS n ${BASE_JOIN} WHERE ${where}`, params }
}

/** Distinct matching climb uuids (used to subset the export). */
export function buildUuidSql(f: FilterState): BuiltSql {
  const { sql: where, params } = buildConditions(f)
  return { sql: `SELECT DISTINCT c.uuid AS uuid ${BASE_JOIN} WHERE ${where}`, params }
}
