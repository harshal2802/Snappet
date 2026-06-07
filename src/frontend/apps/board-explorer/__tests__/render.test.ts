import { describe, it, expect } from 'vitest'
import {
  decodeFrames,
  normalizeColor,
  buildRenderHolds,
  indexPlacements,
  indexRoles,
  layoutBounds,
  boundsFromBox,
  unionBounds,
} from '../render'
import type { HoldPos, RoleInfo } from '../types'

describe('decodeFrames', () => {
  it('parses placement/role tokens', () => {
    expect(decodeFrames('p1235r7p1259r4')).toEqual([
      { placementId: 1235, roleId: 7 },
      { placementId: 1259, roleId: 4 },
    ])
  })
  it('returns [] for empty or non-matching input', () => {
    expect(decodeFrames('')).toEqual([])
    expect(decodeFrames('garbage')).toEqual([])
  })
})

describe('normalizeColor', () => {
  it('prefixes a valid 6-hex colour', () => {
    expect(normalizeColor('00FF00')).toBe('#00FF00')
    expect(normalizeColor('#abc123')).toBe('#abc123')
  })
  it('falls back to grey for missing/invalid', () => {
    expect(normalizeColor(undefined)).toBe('#888888')
    expect(normalizeColor('nope')).toBe('#888888')
  })
})

const placements: HoldPos[] = [
  { placementId: 1, layoutId: 1, x: 10, y: 10 },
  { placementId: 2, layoutId: 1, x: 50, y: 90 },
  { placementId: 3, layoutId: 8, x: 0, y: 0 },
]
const roles: RoleInfo[] = [
  { id: 12, name: 'start', color: '00FF00' },
  { id: 14, name: 'finish', color: 'FF0000' },
]

describe('buildRenderHolds', () => {
  it('resolves placement x/y + role colour, skipping unknown placements', () => {
    const holds = buildRenderHolds('p1r12p2r14p999r12', indexPlacements(placements), indexRoles(roles))
    expect(holds).toEqual([
      { x: 10, y: 10, roleId: 12, roleName: 'start', color: '#00FF00' },
      { x: 50, y: 90, roleId: 14, roleName: 'finish', color: '#FF0000' },
    ])
  })
  it('uses grey and a blank name when the role is unknown', () => {
    const holds = buildRenderHolds('p1r99', indexPlacements(placements), indexRoles(roles))
    expect(holds[0].color).toBe('#888888')
    expect(holds[0].roleName).toBe('')
  })
})

describe('bounds', () => {
  it('layoutBounds covers only the layout’s holds', () => {
    expect(layoutBounds(placements, 1)).toEqual({ minX: 10, maxX: 50, minY: 10, maxY: 90 })
  })
  it('returns null when no holds match the layout', () => {
    expect(layoutBounds(placements, 99)).toBeNull()
  })
  it('boundsFromBox maps a size box and unionBounds merges extents', () => {
    const box = boundsFromBox([0, 100, 0, 150])
    expect(box).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 150 })
    expect(unionBounds(box, { minX: -20, maxX: 80, minY: 10, maxY: 200 })).toEqual({
      minX: -20,
      maxX: 100,
      minY: 0,
      maxY: 200,
    })
  })
})
