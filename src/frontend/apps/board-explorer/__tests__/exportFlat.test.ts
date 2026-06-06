import { describe, it, expect } from 'vitest'
import { toCsv, toJson } from '../exportFlat'
import type { ClimbRow } from '../types'

const rows: ClimbRow[] = [
  { uuid: 'U1', name: 'Crimp Sender', setter: 'asana', angle: 40, grade: '6C+/V5', difficulty: 16.2, ascents: 100, quality: 3, benchmark: false },
  { uuid: 'U2', name: 'Quote, "Storm"', setter: 'boltz', angle: 30, grade: '7B/V8', difficulty: 19.1, ascents: 250, quality: 4.25, benchmark: true },
]

describe('toCsv', () => {
  it('writes a header even with no rows', () => {
    expect(toCsv([])).toBe('uuid,name,setter,angle,grade,difficulty,ascents,quality,benchmark\n')
  })

  it('escapes commas and quotes', () => {
    const csv = toCsv(rows)
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('U1,Crimp Sender,asana,40,6C+/V5,16.2,100,3,no')
    expect(lines[2]).toContain('"Quote, ""Storm"""')
    expect(lines[2]).toContain(',yes')
  })
})

describe('toJson', () => {
  it('round-trips the rows', () => {
    expect(JSON.parse(toJson(rows))).toEqual(rows)
  })
})
