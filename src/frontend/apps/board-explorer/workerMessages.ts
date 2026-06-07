import type {
  ClimbDetail,
  ClimbRow,
  FilterState,
  Grade,
  HoldPos,
  LayoutInfo,
  RoleInfo,
  SizeInfo,
  ValidationResult,
} from './types'

export interface WorkerMeta {
  climbCount: number
  layouts: LayoutInfo[]
  sizes: SizeInfo[]
  angles: number[]
  grades: Grade[]
  placements: HoldPos[]
  roles: RoleInfo[]
}

export type WorkerRequest =
  | { type: 'open'; id: number; bytes: ArrayBuffer; wasmUrl: string }
  | { type: 'query'; id: number; filter: FilterState; limit: number; offset: number }
  | { type: 'count'; id: number; filter: FilterState }
  | { type: 'climb'; id: number; uuid: string }
  | { type: 'exportRows'; id: number; filter: FilterState; cap: number }
  | { type: 'exportDb'; id: number; filter: FilterState; mobileCompatible: boolean }

export type WorkerResponse =
  | { type: 'opened'; id: number; meta: WorkerMeta }
  | { type: 'rows'; id: number; rows: ClimbRow[] }
  | { type: 'count'; id: number; n: number }
  | { type: 'climb'; id: number; climb: ClimbDetail | null }
  | { type: 'rowsAll'; id: number; rows: ClimbRow[] }
  | { type: 'exportDb'; id: number; bytes: ArrayBuffer; validation: ValidationResult }
  | { type: 'error'; id: number; message: string }
