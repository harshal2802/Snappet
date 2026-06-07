// Pure geometry for the board renderer — no React, no sql.js — so it unit-tests in
// Node. A climb's `frames` ("p<placement>r<role>…") resolves to (x, y, role colour)
// via the placement→hole grid and the placement_roles table, both read once into
// BoardMeta when a board opens.

import type { HoldPos, RoleInfo, SizeBox } from './types'

export interface DecodedHold {
  placementId: number
  roleId: number
}

/** `"p1235r7p1259r4"` → `[{placementId:1235,roleId:7}, {placementId:1259,roleId:4}]`. */
export function decodeFrames(frames: string): DecodedHold[] {
  const out: DecodedHold[] = []
  const re = /p(\d+)r(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(frames))) out.push({ placementId: Number(m[1]), roleId: Number(m[2]) })
  return out
}

/** Normalise an Aurora colour (hex, no '#') to a CSS colour; fall back to grey. */
export function normalizeColor(c: string | undefined): string {
  const h = (c ?? '').replace('#', '')
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h}` : '#888888'
}

export interface RenderHold {
  x: number
  y: number
  roleId: number
  roleName: string
  color: string
}

export function indexPlacements(placements: HoldPos[]): Map<number, HoldPos> {
  return new Map(placements.map((p) => [p.placementId, p]))
}

export function indexRoles(roles: RoleInfo[]): Map<number, RoleInfo> {
  return new Map(roles.map((r) => [r.id, r]))
}

/** Resolve a climb's frames to drawable holds, skipping placements not in the grid. */
export function buildRenderHolds(
  frames: string,
  placementById: Map<number, HoldPos>,
  roleById: Map<number, RoleInfo>,
): RenderHold[] {
  const holds: RenderHold[] = []
  for (const { placementId, roleId } of decodeFrames(frames)) {
    const p = placementById.get(placementId)
    if (!p) continue
    const role = roleById.get(roleId)
    holds.push({
      x: p.x,
      y: p.y,
      roleId,
      roleName: role?.name ?? '',
      color: normalizeColor(role?.color),
    })
  }
  return holds
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** Extent of one layout's holds — the board frame to draw the climb against. */
export function layoutBounds(placements: HoldPos[], layoutId: number): Bounds | null {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of placements) {
    if (p.layoutId !== layoutId) continue
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null
}

export function boundsFromBox(box: SizeBox): Bounds {
  return { minX: box[0], maxX: box[1], minY: box[2], maxY: box[3] }
}

/** Union of two bounds (so a climb's holds always fit even if they spill a box). */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  }
}
