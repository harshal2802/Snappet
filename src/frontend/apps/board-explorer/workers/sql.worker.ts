// sql.js runs here, off the main thread — a single live source DB per worker.
// Loads the gzipped-then-decompressed board bytes, answers filter queries, and
// builds the filtered `.db` export. Large buffers are transferred, not copied.

import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import { buildListingSql, buildCountSql } from '../query'
import { buildFilteredDb } from '../exportDb'
import { gradeLabel } from '../grades'
import type { ClimbRow, Grade, LayoutInfo } from '../types'
import type { WorkerMeta, WorkerRequest, WorkerResponse } from '../workerMessages'

const ctx = self as unknown as Worker

let sqlPromise: Promise<SqlJsStatic> | null = null
let db: Database | null = null
let grades: Grade[] = []

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

function readMeta(d: Database): WorkerMeta {
  const climbCount = Number(execRows(d, 'SELECT COUNT(*) FROM climbs')[0]?.[0] ?? 0)
  const layouts: LayoutInfo[] = execRows(
    d,
    'SELECT l.id, l.name FROM layouts l WHERE l.id IN ' +
      '(SELECT DISTINCT layout_id FROM climbs WHERE is_listed = 1) ORDER BY l.id',
  ).map((r) => ({ id: Number(r[0]), name: String(r[1] ?? `Layout ${r[0]}`) }))
  const angles = execRows(d, 'SELECT DISTINCT angle FROM climb_stats ORDER BY angle').map((r) =>
    Number(r[0]),
  )
  const gs: Grade[] = execRows(
    d,
    'SELECT difficulty, boulder_name FROM difficulty_grades ORDER BY difficulty',
  ).map((r) => ({ difficulty: Number(r[0]), name: String(r[1] ?? r[0]) }))
  return { climbCount, layouts, angles, grades: gs }
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
        post({ type: 'opened', id: msg.id, meta })
        break
      }
      case 'query': {
        if (!db) throw new Error('No board loaded')
        const { sql, params } = buildListingSql(msg.filter, msg.limit, msg.offset)
        post({ type: 'rows', id: msg.id, rows: listing(db, sql, params) })
        break
      }
      case 'count': {
        if (!db) throw new Error('No board loaded')
        const { sql, params } = buildCountSql(msg.filter)
        const n = Number(execRows2(db, sql, params)[0]?.[0] ?? 0)
        post({ type: 'count', id: msg.id, n })
        break
      }
      case 'exportRows': {
        if (!db) throw new Error('No board loaded')
        const { sql, params } = buildListingSql(msg.filter, msg.cap, 0)
        post({ type: 'rowsAll', id: msg.id, rows: listing(db, sql, params) })
        break
      }
      case 'exportDb': {
        if (!db) throw new Error('No board loaded')
        const SQL = await getSql('')
        const { bytes, validation } = buildFilteredDb(SQL, db, msg.filter, {
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
