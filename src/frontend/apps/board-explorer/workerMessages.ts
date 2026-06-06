import type { ClimbRow, FilterState, Grade, LayoutInfo, ValidationResult } from './types'

export interface WorkerMeta {
  climbCount: number
  layouts: LayoutInfo[]
  angles: number[]
  grades: Grade[]
}

export type WorkerRequest =
  | { type: 'open'; id: number; bytes: ArrayBuffer; wasmUrl: string }
  | { type: 'query'; id: number; filter: FilterState; limit: number; offset: number }
  | { type: 'count'; id: number; filter: FilterState }
  | { type: 'exportRows'; id: number; filter: FilterState; cap: number }
  | { type: 'exportDb'; id: number; filter: FilterState; mobileCompatible: boolean }

export type WorkerResponse =
  | { type: 'opened'; id: number; meta: WorkerMeta }
  | { type: 'rows'; id: number; rows: ClimbRow[] }
  | { type: 'count'; id: number; n: number }
  | { type: 'rowsAll'; id: number; rows: ClimbRow[] }
  | { type: 'exportDb'; id: number; bytes: ArrayBuffer; validation: ValidationResult }
  | { type: 'error'; id: number; message: string }
