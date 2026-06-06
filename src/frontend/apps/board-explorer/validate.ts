// Replicates snappet-mobile's KilterCatalogValidator so the app can reject an
// export the phone would refuse — BEFORE offering the download. Operates on a
// sql.js Database (works in Node too, so it unit-tests without a browser).

import type { Database } from 'sql.js'
import { REQUIRED_TABLES, MAX_CATALOG_BYTES } from './schema'
import type { ValidationResult } from './types'

function tableNames(db: Database): Set<string> {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
  const names = new Set<string>()
  if (res.length) for (const row of res[0].values) names.add(String(row[0]))
  return names
}

function scalarInt(db: Database, sql: string): number {
  const res = db.exec(sql)
  if (!res.length || !res[0].values.length) return 0
  const v = res[0].values[0][0]
  return typeof v === 'number' ? v : Number(v ?? 0)
}

/**
 * Validate a catalog DB. `sizeBytes` is the exported file size (the validator's
 * 512 MB cap is on the file, not the live DB).
 */
export function validateCatalog(db: Database, sizeBytes: number): ValidationResult {
  const errors: string[] = []
  const names = tableNames(db)

  for (const t of REQUIRED_TABLES) {
    if (!names.has(t)) errors.push(`Missing required table: ${t}`)
  }

  let listedCount = 0
  let climbCount = 0
  if (names.has('climbs')) {
    climbCount = scalarInt(db, 'SELECT COUNT(*) FROM climbs')
    listedCount = scalarInt(db, 'SELECT COUNT(*) FROM climbs WHERE is_listed = 1')
    if (listedCount < 1) errors.push('No listed climbs (need at least one).')
  }

  if (sizeBytes > MAX_CATALOG_BYTES) {
    errors.push(
      `File is ${(sizeBytes / 1_000_000).toFixed(0)} MB — exceeds the 512 MB import limit.`,
    )
  }

  return { ok: errors.length === 0, errors, climbCount, listedCount, sizeBytes }
}
