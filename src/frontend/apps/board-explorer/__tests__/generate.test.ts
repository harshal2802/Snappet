import { describe, it, expect } from 'vitest'
import {
  decodeClimb,
  generateReranked,
  predictGrade,
  prepare,
  type GenMeta,
  type RunLogits,
} from '../generate/decode'

// A tiny self-consistent vocab: 4 holds (start/middle/finish/foot) on one size.
const META: GenMeta = {
  block: 16,
  pad: 0,
  specials: { BOS: 1, EOS: 2, PAD: 0, MATCH: 6, NOMATCH: 7 },
  firstHoldId: 8,
  itos: ['PAD', 'BOS', 'EOS', 'SIZE_1', 'ANGLE_0', 'GRADE_5', 'MATCH', 'NOMATCH',
    'HOLD_100_12', 'HOLD_101_13', 'HOLD_102_14', 'HOLD_103_15'],
  sizes: [{ id: 1, name: 'test', box: [0, 10, 0, 10] }],
  placements: [{ id: 100, x: 1, y: 1 }, { id: 101, x: 2, y: 5 }, { id: 102, x: 3, y: 9 }, { id: 103, x: 1, y: 0 }],
  roles: [
    { id: 12, name: 'start', color: '00DD00' },
    { id: 13, name: 'middle', color: '00FFFF' },
    { id: 14, name: 'finish', color: 'FF00FF' },
    { id: 15, name: 'foot', color: 'FFA500' },
  ],
  sizeMasks: { '1': [8, 9, 10, 11, 2] }, // four holds + EOS
  sizeNames: { '1': 'test' },
  gradeModel: { bias: 1, w_nomatch: 2, w_angle: [0.5], angle_index: { '0': 0 }, w_hold: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], y_mean: 4 },
  grades: [5],
  gradeLabels: { '5': '5a/V0' },
  angles: [0],
  defaultSize: 1,
}

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Constant logits over the vocab, with optional per-token overrides. */
function fakeLogits(overrides: Record<number, number> = {}): RunLogits {
  const v = new Float32Array(META.itos.length)
  for (const [k, val] of Object.entries(overrides)) v[Number(k)] = val
  return () => v
}

function placementsOf(frames: string): number[] {
  return [...frames.matchAll(/p(\d+)r(\d+)/g)].map((m) => Number(m[1]))
}
function rolesOf(frames: string): number[] {
  return [...frames.matchAll(/p(\d+)r(\d+)/g)].map((m) => Number(m[2]))
}

describe('decodeClimb', () => {
  const prep = prepare(META)

  it('produces a valid climb: no duplicate placements, all within the size mask, ≥1 start & finish', async () => {
    const c = await decodeClimb(META, prep, { sizeId: 1, angle: 0, grade: 5, nomatch: false }, fakeLogits(), rng(1))
    expect(c.frames).toMatch(/^(p\d+r\d+)+$/)
    const ps = placementsOf(c.frames)
    expect(new Set(ps).size).toBe(ps.length) // no dupes
    expect(ps.every((p) => [100, 101, 102, 103].includes(p))).toBe(true) // in mask
    const roles = rolesOf(c.frames)
    expect(roles).toContain(12) // start
    expect(roles).toContain(14) // finish
    expect(c.holds.length).toBeLessThanOrEqual(20)
  })

  it('repairs missing start/finish even when the model never emits them', async () => {
    // Make start (8) and finish (10) extremely unlikely to be sampled.
    const c = await decodeClimb(
      META, prep, { sizeId: 1, angle: 0, grade: 5, nomatch: false, maxHolds: 6 },
      fakeLogits({ 8: -1e9, 10: -1e9 }), rng(2),
    )
    expect(rolesOf(c.frames)).toContain(12)
    expect(rolesOf(c.frames)).toContain(14)
  })

  it('is deterministic for a fixed RNG seed', async () => {
    const opts = { sizeId: 1, angle: 0, grade: 5, nomatch: false }
    const a = await decodeClimb(META, prep, opts, fakeLogits(), rng(42))
    const b = await decodeClimb(META, prep, opts, fakeLogits(), rng(42))
    expect(a.frames).toBe(b.frames)
  })

  it('throws on an unknown board size', async () => {
    await expect(decodeClimb(META, prep, { sizeId: 999, angle: 0, grade: 5, nomatch: false }, fakeLogits())).rejects.toThrow()
  })
})

describe('predictGrade + reranking', () => {
  it('applies bias, no-match, angle, and mean terms', () => {
    expect(predictGrade(META.gradeModel, [], 0, false)).toBeCloseTo(1 + 0.5 + 4) // bias+angle+mean
    expect(predictGrade(META.gradeModel, [], 0, true)).toBeCloseTo(1 + 2 + 0.5 + 4) // +nomatch
  })

  it('returns a climb with a predicted grade', async () => {
    const prep = prepare(META)
    const c = await generateReranked(META, prep, { sizeId: 1, angle: 0, grade: 5, nomatch: false }, fakeLogits(), 4, rng(3))
    expect(typeof c.predictedGrade).toBe('number')
    expect(c.frames.length).toBeGreaterThan(0)
  })
})
