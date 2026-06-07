export type SortKey = 'popularity' | 'quality' | 'grade-asc' | 'grade-desc' | 'name'

export interface FilterState {
  layoutId: number | null
  /** A product_sizes.id to restrict to climbs that physically fit that board size, or null. */
  sizeId: number | null
  /** Specific board angle, or null for "any angle" (best/most-climbed angle is shown). */
  angle: number | null
  /** Inclusive grade range as difficulty_grades.difficulty integers, or null for open-ended. */
  gradeMin: number | null
  gradeMax: number | null
  minAscents: number | null
  /** 0..5 stars. */
  minQuality: number | null
  setter: string
  name: string
  benchmarkOnly: boolean
  listedOnly: boolean
  singleFrameOnly: boolean
  sort: SortKey
  /** Internal: restrict to these layouts (used by the mobile-compatible export). */
  layoutIds?: number[]
  /** Internal: the size's box resolved from `sizeId` (injected by the worker, never persisted). */
  sizeBox?: SizeBox
}

export const DEFAULT_FILTER: FilterState = {
  layoutId: null,
  sizeId: null,
  angle: null,
  gradeMin: null,
  gradeMax: null,
  minAscents: null,
  minQuality: null,
  setter: '',
  name: '',
  benchmarkOnly: false,
  listedOnly: true,
  singleFrameOnly: false,
  sort: 'popularity',
}

export interface Grade {
  difficulty: number
  name: string
}

export interface LayoutInfo {
  id: number
  name: string
  productId: number
}

/** A board size: a rectangle in hole-coordinate units a climb must fit within. */
export type SizeBox = [left: number, right: number, bottom: number, top: number]

export interface SizeInfo {
  id: number
  productId: number
  name: string
  description: string
  box: SizeBox
}

/** A placement resolved to its (x, y) on the board, tagged with its layout. */
export interface HoldPos {
  placementId: number
  layoutId: number
  x: number
  y: number
}

/** A placement role (start / middle / finish / foot / …) and its on-screen colour. */
export interface RoleInfo {
  id: number
  name: string
  /** Hex RGB without a leading '#', e.g. "00FF00". */
  color: string
}

/** One climb's raw geometry, fetched on demand to render it on the board. */
export interface ClimbDetail {
  uuid: string
  layoutId: number
  name: string
  setter: string
  frames: string
}

/** Reference data + counts pulled once when a board DB is opened. */
export interface BoardMeta {
  board: string
  label: string
  climbCount: number
  generatedAt: string
  isFixture: boolean
  importableToMobile: boolean
  layouts: LayoutInfo[]
  sizes: SizeInfo[]
  angles: number[]
  grades: Grade[]
  /** Every layout's holds (placement → x/y), for the board renderer. */
  placements: HoldPos[]
  roles: RoleInfo[]
}

export interface ManifestEntry {
  board: string
  label: string
  file: string
  /** Optional absolute URL (e.g. a GitHub Release asset); falls back to public/board-data/<file>. */
  url?: string
  climbs: number
  generatedAt: string
  isFixture: boolean
  importableToMobile: boolean
  sizeBytesGz: number
  sizeBytesRaw: number
}

export interface Manifest {
  generatedAt: string
  boards: ManifestEntry[]
}

/** A row in the results table (one per matching climb, at its best matching angle). */
export interface ClimbRow {
  uuid: string
  name: string
  setter: string
  angle: number
  /** Rounded display grade label (e.g. "7A/V6"). */
  grade: string
  difficulty: number
  ascents: number
  quality: number
  benchmark: boolean
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  climbCount: number
  listedCount: number
  sizeBytes: number
}

export type ExportFormat = 'csv' | 'json' | 'db'
