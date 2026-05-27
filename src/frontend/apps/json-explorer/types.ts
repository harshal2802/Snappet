/** Primitive JSON value types */
export type JsonPrimitive = string | number | boolean | null

/** Any valid JSON value */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

/** JSON object type */
export interface JsonObject {
  [key: string]: JsonValue
}

/** JSON array type */
export type JsonArray = JsonValue[]

/** Diff entry classification */
export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged'

/** A single diff entry describing a difference at a specific path */
export interface DiffEntry {
  path: string
  kind: DiffKind
  oldValue?: JsonValue
  newValue?: JsonValue
}

/** Mode toggle for the app */
export type AppMode = 'explorer' | 'diff'
