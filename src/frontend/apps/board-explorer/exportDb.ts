// Browser-side reimplementation of snappet-mobile's build_bundled_db.py: build a
// fresh, schema-faithful SQLite catalog containing only the filtered climbs, so the
// result imports into the mobile app's "Import catalog file…" flow.
//
// Strategy: recreate every required table from its original CREATE DDL (read from
// the source via sqlite_master), copy reference/geometry tables WHOLE, subset the
// climb tables via a temp uuid table, recreate indexes, VACUUM, export bytes, then
// validate before returning. Inserts stream through prepared statements inside a
// single transaction (sql.js auto-commits per row otherwise — far slower).

import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import { FULL_TABLES, CLIMB_TABLES, MOBILE_LAYOUT_IDS } from './schema'
import type { FilterState, ValidationResult } from './types'
import { buildUuidSql } from './query'
import { validateCatalog } from './validate'

export interface ExportResult {
  bytes: Uint8Array
  validation: ValidationResult
}

function tableExists(db: Database, name: string): boolean {
  const res = db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [name])
  return res.length > 0 && res[0].values.length > 0
}

function tableDDL(db: Database, name: string): string | null {
  const res = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [name])
  if (!res.length || !res[0].values.length) return null
  const sql = res[0].values[0][0]
  return typeof sql === 'string' ? sql : null
}

function columnNames(db: Database, table: string): string[] {
  const res = db.exec(`PRAGMA table_info(${table})`)
  if (!res.length) return []
  return res[0].values.map((r) => String(r[1]))
}

/** Stream rows from `source` (via selectSql) into the same-named table in `out`. */
function copyRows(source: Database, out: Database, table: string, selectSql: string, params: SqlValue[]): void {
  const cols = columnNames(source, table)
  if (!cols.length) return
  const insert = out.prepare(`INSERT INTO "${table}" VALUES (${cols.map(() => '?').join(',')})`)
  const read = source.prepare(selectSql, params)
  out.run('BEGIN')
  try {
    while (read.step()) insert.run(read.get() as SqlValue[])
    out.run('COMMIT')
  } catch (e) {
    out.run('ROLLBACK')
    throw e
  } finally {
    insert.free()
    read.free()
  }
}

export interface ExportOptions {
  /** Force snappet-mobile compatibility: single-frame, listed, layouts 1 & 8. */
  mobileCompatible?: boolean
}

export function buildFilteredDb(
  SQL: SqlJsStatic,
  source: Database,
  filter: FilterState,
  opts: ExportOptions = {},
): ExportResult {
  // Effective filter: mobile mode pins the constraints the phone's importer needs.
  const eff: FilterState = opts.mobileCompatible
    ? {
        ...filter,
        listedOnly: true,
        singleFrameOnly: true,
        layoutIds:
          typeof filter.layoutId === 'number' ? undefined : [...MOBILE_LAYOUT_IDS],
      }
    : filter

  const out = new SQL.Database()
  try {
    const fullPresent = FULL_TABLES.filter((t) => tableExists(source, t))
    const climbPresent = Object.keys(CLIMB_TABLES).filter((t) => tableExists(source, t))
    const allTables = [...fullPresent, ...climbPresent]

    // 1. Recreate schema (parents first: FULL_TABLES then climb tables).
    for (const t of allTables) {
      const ddl = tableDDL(source, t)
      if (ddl) out.run(ddl)
    }

    // 2. Copy reference/geometry tables whole.
    for (const t of fullPresent) copyRows(source, out, t, `SELECT * FROM "${t}"`, [])

    // 3. Resolve filtered uuids and stage them in a temp table on the SOURCE.
    const { sql: uuidSql, params } = buildUuidSql(eff)
    source.run('CREATE TEMP TABLE IF NOT EXISTS _keep (uuid TEXT PRIMARY KEY)')
    source.run('DELETE FROM _keep')
    const ins = source.prepare('INSERT OR IGNORE INTO _keep VALUES (?)')
    const reader = source.prepare(uuidSql, params)
    source.run('BEGIN')
    try {
      while (reader.step()) ins.run(reader.get() as SqlValue[])
      source.run('COMMIT')
    } catch (e) {
      source.run('ROLLBACK')
      throw e
    } finally {
      ins.free()
      reader.free()
    }

    // 4. Subset the climb tables by joining against _keep.
    for (const t of climbPresent) {
      const key = CLIMB_TABLES[t]
      copyRows(source, out, t, `SELECT "${t}".* FROM "${t}" JOIN _keep k ON k.uuid = "${t}"."${key}"`, [])
    }
    source.run('DROP TABLE IF EXISTS _keep')

    // 5. Recreate indexes for the tables we copied.
    const idx = source.exec(
      "SELECT sql, tbl_name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL",
    )
    if (idx.length) {
      const keep = new Set(allTables)
      for (const row of idx[0].values) {
        const sql = row[0]
        const tbl = String(row[1])
        if (keep.has(tbl) && typeof sql === 'string') {
          try {
            out.run(sql)
          } catch {
            /* skip a non-portable index rather than fail the whole export */
          }
        }
      }
    }

    out.run('VACUUM')
    const bytes = out.export()
    const validation = validateCatalog(out, bytes.length)
    return { bytes, validation }
  } finally {
    out.close()
  }
}
