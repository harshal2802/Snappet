export type SortKey = 'popularity' | 'quality' | 'grade-asc' | 'grade-desc' | 'name'

export interface FilterState {
  layoutId: number | null
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
}

export const DEFAULT_FILTER: FilterState = {
  layoutId: null,
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
  angles: number[]
  grades: Grade[]
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
