// sql.js runs here, off the main thread — a single live source DB per worker.
// Loads the gzipped-then-decompressed board bytes, answers filter queries, and
// builds the filtered `.db` export. Large buffers are transferred, not copied.

import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import { buildListingSql, buildCountSql, withResolvedSize } from '../query'
import { buildFilteredDb } from '../exportDb'
import { gradeLabel } from '../grades'
import type { ClimbRow, Grade, HoldPos, LayoutInfo, RoleInfo, SizeInfo } from '../types'
import type { WorkerMeta, WorkerRequest, WorkerResponse } from '../workerMessages'

const ctx = self as unknown as Worker

let sqlPromise: Promise<SqlJsStatic> | null = null
let db: Database | null = null
let grades: Grade[] = []
let sizes: SizeInfo[] = []

function getSql(wasmUrl: string): Promise<SqlJsStatic> {
  if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: () => wasmUrl })
  return sqlPromise
}

function post(msg: WorkerResponse, transfer?: Transferable[]): void {
  if (transfer) ctx.postMessage(msg, transfer)
  else ctx.postMessage(msg)
}

function execRows(d: Database, sql: string): SqlValue[][] {
  const res = d.exec(sql)
  return res.length ? res[0].values : []
}

function tableExists(d: Database, name: string): boolean {
  return execRows(d, `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0
}

function readSizes(d: Database): SizeInfo[] {
  if (!tableExists(d, 'product_sizes')) return []
  return execRows(
    d,
    'SELECT id, product_id, name, description, edge_left, edge_right, edge_bottom, edge_top ' +
      'FROM product_sizes WHERE is_listed = 1 ORDER BY product_id, position',
  ).map((r) => ({
    id: Number(r[0]),
    productId: Number(r[1]),
    name: String(r[2] ?? `Size ${r[0]}`),
    description: String(r[3] ?? ''),
    box: [Number(r[4]), Number(r[5]), Number(r[6]), Number(r[7])],
  }))
}

function readPlacements(d: Database): HoldPos[] {
  if (!tableExists(d, 'placements') || !tableExists(d, 'holes')) return []
  return execRows(
    d,
    'SELECT p.id, p.layout_id, h.x, h.y FROM placements p JOIN holes h ON h.id = p.hole_id',
  ).map((r) => ({ placementId: Number(r[0]), layoutId: Number(r[1]), x: Number(r[2]), y: Number(r[3]) }))
}

function readRoles(d: Database): RoleInfo[] {
  if (!tableExists(d, 'placement_roles')) return []
  return execRows(d, 'SELECT id, name, screen_color FROM placement_roles').map((r) => ({
    id: Number(r[0]),
    name: String(r[1] ?? ''),
    color: String(r[2] ?? '888888'),
  }))
}

function readMeta(d: Database): WorkerMeta {
  const climbCount = Number(execRows(d, 'SELECT COUNT(*) FROM climbs')[0]?.[0] ?? 0)
  const layouts: LayoutInfo[] = execRows(
    d,
    'SELECT l.id, l.name, l.product_id FROM layouts l WHERE l.id IN ' +
      '(SELECT DISTINCT layout_id FROM climbs WHERE is_listed = 1) ORDER BY l.id',
  ).map((r) => ({ id: Number(r[0]), name: String(r[1] ?? `Layout ${r[0]}`), productId: Number(r[2] ?? 0) }))
  const angles = execRows(d, 'SELECT DISTINCT angle FROM climb_stats ORDER BY angle').map((r) =>
    Number(r[0]),
  )
  const gs: Grade[] = execRows(
    d,
    'SELECT difficulty, boulder_name FROM difficulty_grades ORDER BY difficulty',
  ).map((r) => ({ difficulty: Number(r[0]), name: String(r[1] ?? r[0]) }))
  return {
    climbCount,
    layouts,
    sizes: readSizes(d),
    angles,
    grades: gs,
    placements: readPlacements(d),
    roles: readRoles(d),
  }
}

function listing(d: Database, sql: string, params: SqlValue[]): ClimbRow[] {
  const stmt = d.prepare(sql, params)
  const rows: ClimbRow[] = []
  try {
    while (stmt.step()) {
      const o = stmt.getAsObject()
      const difficulty = Number(o.difficulty ?? 0)
      rows.push({
        uuid: String(o.uuid),
        name: String(o.name ?? ''),
        setter: String(o.setter ?? ''),
        angle: Number(o.angle ?? 0),
        difficulty,
        grade: gradeLabel(grades, difficulty),
        ascents: Number(o.ascents ?? 0),
        quality: Number(o.quality ?? 0),
        benchmark: Number(o.benchmark ?? 0) === 1,
      })
    }
  } finally {
    stmt.free()
  }
  return rows
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  try {
    switch (msg.type) {
      case 'open': {
        const SQL = await getSql(msg.wasmUrl)
        if (db) db.close()
        db = new SQL.Database(new Uint8Array(msg.bytes))
        const meta = readMeta(db)
        grades = meta.grades
        sizes = meta.sizes
        post({ type: 'opened', id: msg.id, meta })
        break
      }
      case 'query': {
        if (!db) throw new Error('No board loaded')
        const { sql, params } = buildListingSql(withResolvedSize(msg.filter, sizes), msg.limit, msg.offset)
        post({ type: 'rows', id: msg.id, rows: listing(db, sql, params) })
        break
      }
      case 'count': {
        if (!db) throw new Error('No board loaded')
        const { sql, params } = buildCountSql(withResolvedSize(msg.filter, sizes))
        const n = Number(execRows2(db, sql, params)[0]?.[0] ?? 0)
        post({ type: 'count', id: msg.id, n })
        break
      }
      case 'climb': {
        if (!db) throw new Error('No board loaded')
        const row = execRows2(
          db,
          'SELECT layout_id, name, setter_username, frames FROM climbs WHERE uuid = ?',
          [msg.uuid],
        )[0]
        const climb = row
          ? { uuid: msg.uuid, layoutId: Number(row[0]), name: String(row[1] ?? ''), setter: String(row[2] ?? ''), frames: String(row[3] ?? '') }
          : null
        post({ type: 'climb', id: msg.id, climb })
        break
      }
      case 'exportRows': {
        if (!db) throw new Error('No board loaded')
        const { sql, params } = buildListingSql(withResolvedSize(msg.filter, sizes), msg.cap, 0)
        post({ type: 'rowsAll', id: msg.id, rows: listing(db, sql, params) })
        break
      }
      case 'exportDb': {
        if (!db) throw new Error('No board loaded')
        const SQL = await getSql('')
        const { bytes, validation } = buildFilteredDb(SQL, db, withResolvedSize(msg.filter, sizes), {
          mobileCompatible: msg.mobileCompatible,
        })
        const buf = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer
        post({ type: 'exportDb', id: msg.id, bytes: buf, validation }, [buf])
        break
      }
    }
  } catch (e) {
    post({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) })
  }
}

function execRows2(d: Database, sql: string, params: SqlValue[]): SqlValue[][] {
  const stmt = d.prepare(sql, params)
  const out: SqlValue[][] = []
  try {
    while (stmt.step()) out.push(stmt.get() as SqlValue[])
  } finally {
    stmt.free()
  }
  return out
}
