// Pure CSV / JSON serializers for the filtered result set. No DOM, no DB — unit-tested in Node.

import type { ClimbRow } from './types'

const CSV_COLUMNS: Array<[string, (r: ClimbRow) => string | number]> = [
  ['uuid', (r) => r.uuid],
  ['name', (r) => r.name],
  ['setter', (r) => r.setter],
  ['angle', (r) => r.angle],
  ['grade', (r) => r.grade],
  ['difficulty', (r) => Number(r.difficulty.toFixed(2))],
  ['ascents', (r) => r.ascents],
  ['quality', (r) => Number(r.quality.toFixed(2))],
  ['benchmark', (r) => (r.benchmark ? 'yes' : 'no')],
]

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: ClimbRow[]): string {
  const header = CSV_COLUMNS.map(([h]) => h).join(',')
  const body = rows
    .map((r) => CSV_COLUMNS.map(([, get]) => csvCell(get(r))).join(','))
    .join('\n')
  return body ? `${header}\n${body}\n` : `${header}\n`
}

export function toJson(rows: ClimbRow[]): string {
  return JSON.stringify(rows, null, 2)
}
