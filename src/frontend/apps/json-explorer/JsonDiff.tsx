import { useState } from 'react'
import type { JsonValue, JsonObject, JsonArray, DiffEntry } from './types'

interface JsonDiffProps {
  original: JsonValue
  modified: JsonValue
}

function isObject(val: JsonValue): val is JsonObject {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}

function isArray(val: JsonValue): val is JsonArray {
  return Array.isArray(val)
}

function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => key in b && deepEqual(a[key], b[key]))
  }

  return false
}

function computeDiff(
  original: JsonValue,
  modified: JsonValue,
  path: string
): DiffEntry[] {
  const entries: DiffEntry[] = []

  if (deepEqual(original, modified)) {
    entries.push({ path: path || '(root)', kind: 'unchanged', oldValue: original, newValue: modified })
    return entries
  }

  // Both are objects
  if (isObject(original) && isObject(modified)) {
    const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)])
    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key
      const inOrig = key in original
      const inMod = key in modified

      if (inOrig && !inMod) {
        entries.push({ path: childPath, kind: 'removed', oldValue: original[key] })
      } else if (!inOrig && inMod) {
        entries.push({ path: childPath, kind: 'added', newValue: modified[key] })
      } else {
        entries.push(...computeDiff(original[key], modified[key], childPath))
      }
    }
    return entries
  }

  // Both are arrays
  if (isArray(original) && isArray(modified)) {
    const maxLen = Math.max(original.length, modified.length)
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${path}[${i}]`
      if (i >= original.length) {
        entries.push({ path: childPath, kind: 'added', newValue: modified[i] })
      } else if (i >= modified.length) {
        entries.push({ path: childPath, kind: 'removed', oldValue: original[i] })
      } else {
        entries.push(...computeDiff(original[i], modified[i], childPath))
      }
    }
    return entries
  }

  // Primitives or type mismatch
  entries.push({ path: path || '(root)', kind: 'changed', oldValue: original, newValue: modified })
  return entries
}

function formatValue(value: JsonValue | undefined): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function truncateValue(value: JsonValue | undefined, maxLen: number = 60): string {
  const str = formatValue(value)
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

interface DiffGroupProps {
  title: string
  kind: 'added' | 'removed' | 'changed' | 'unchanged'
  entries: DiffEntry[]
}

function DiffGroup({ title, kind, entries }: DiffGroupProps) {
  const [expanded, setExpanded] = useState(kind !== 'unchanged')

  if (entries.length === 0) return null

  const bgClass = {
    added: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    removed: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    changed: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
    unchanged: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
  }[kind]

  const iconClass = {
    added: 'text-green-600 dark:text-green-400',
    removed: 'text-red-600 dark:text-red-400',
    changed: 'text-yellow-600 dark:text-yellow-400',
    unchanged: 'text-gray-500 dark:text-gray-400',
  }[kind]

  const icon = {
    added: '+',
    removed: '-',
    changed: '~',
    unchanged: '=',
  }[kind]

  return (
    <div className={`rounded-xl border ${bgClass} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-sm ${iconClass}`}>{icon}</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {title}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({entries.length})
          </span>
        </div>
        <span className={`text-xs transition-transform ${expanded ? 'rotate-90' : ''} text-gray-400 dark:text-gray-500`}>
          ▶
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.path}
              className="font-mono text-xs leading-5 text-gray-700 dark:text-gray-300"
            >
              <span className="text-gray-500 dark:text-gray-400 select-all">
                {entry.path}
              </span>
              {kind === 'added' && (
                <span className="ml-2 text-green-700 dark:text-green-400">
                  {truncateValue(entry.newValue)}
                </span>
              )}
              {kind === 'removed' && (
                <span className="ml-2 text-red-700 dark:text-red-400 line-through">
                  {truncateValue(entry.oldValue)}
                </span>
              )}
              {kind === 'changed' && (
                <span className="ml-2">
                  <span className="text-red-600 dark:text-red-400 line-through">
                    {truncateValue(entry.oldValue)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 mx-1">&rarr;</span>
                  <span className="text-green-600 dark:text-green-400">
                    {truncateValue(entry.newValue)}
                  </span>
                </span>
              )}
              {kind === 'unchanged' && (
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  {truncateValue(entry.oldValue)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { computeDiff }

export default function JsonDiff({ original, modified }: JsonDiffProps) {
  const allDiffs = computeDiff(original, modified, '')

  const added = allDiffs.filter((d) => d.kind === 'added')
  const removed = allDiffs.filter((d) => d.kind === 'removed')
  const changed = allDiffs.filter((d) => d.kind === 'changed')
  const unchanged = allDiffs.filter((d) => d.kind === 'unchanged')

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap gap-3 text-sm font-medium">
        {added.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            +{added.length} addition{added.length !== 1 ? 's' : ''}
          </span>
        )}
        {removed.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            -{removed.length} removal{removed.length !== 1 ? 's' : ''}
          </span>
        )}
        {changed.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
            ~{changed.length} change{changed.length !== 1 ? 's' : ''}
          </span>
        )}
        {added.length === 0 && removed.length === 0 && changed.length === 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            No differences found
          </span>
        )}
      </div>

      {/* Diff groups */}
      <DiffGroup title="Additions" kind="added" entries={added} />
      <DiffGroup title="Removals" kind="removed" entries={removed} />
      <DiffGroup title="Changes" kind="changed" entries={changed} />
      <DiffGroup title="Unchanged" kind="unchanged" entries={unchanged} />
    </div>
  )
}
