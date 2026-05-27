import { useState, useCallback } from 'react'
import type { JsonValue, JsonObject, JsonArray } from './types'

interface JsonTreeProps {
  data: JsonValue
  searchTerm: string
  onCopyPath: (path: string) => void
  expandAll: number
  collapseAll: number
}

interface TreeNodeProps {
  keyName: string | null
  value: JsonValue
  path: string
  depth: number
  searchTerm: string
  onCopyPath: (path: string) => void
  expandAll: number
  collapseAll: number
  isLast: boolean
}

function isObject(val: JsonValue): val is JsonObject {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}

function isArray(val: JsonValue): val is JsonArray {
  return Array.isArray(val)
}

function matchesSearch(key: string | null, value: JsonValue, term: string): boolean {
  if (!term) return false
  const lowerTerm = term.toLowerCase()
  if (key !== null && key.toLowerCase().includes(lowerTerm)) return true
  if (typeof value === 'string' && value.toLowerCase().includes(lowerTerm)) return true
  if (typeof value === 'number' && String(value).includes(term)) return true
  if (typeof value === 'boolean' && String(value).toLowerCase().includes(lowerTerm)) return true
  if (value === null && 'null'.includes(lowerTerm)) return true
  return false
}

function hasMatchInSubtree(key: string | null, value: JsonValue, term: string): boolean {
  if (!term) return true
  if (matchesSearch(key, value, term)) return true
  if (isObject(value)) {
    return Object.entries(value).some(([k, v]) => hasMatchInSubtree(k, v, term))
  }
  if (isArray(value)) {
    return value.some((item, i) => hasMatchInSubtree(String(i), item, term))
  }
  return false
}

function renderValue(value: JsonValue): { text: string; colorClass: string } {
  if (value === null) return { text: 'null', colorClass: 'text-gray-400 dark:text-gray-500' }
  if (typeof value === 'boolean') return { text: String(value), colorClass: 'text-purple-600 dark:text-purple-400' }
  if (typeof value === 'number') return { text: String(value), colorClass: 'text-blue-600 dark:text-blue-400' }
  if (typeof value === 'string') return { text: `"${value}"`, colorClass: 'text-green-600 dark:text-green-400' }
  return { text: '', colorClass: '' }
}

function TreeNode({
  keyName,
  value,
  path,
  depth,
  searchTerm,
  onCopyPath,
  expandAll,
  collapseAll,
  isLast,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  // Respond to expand/collapse all triggers
  const [lastExpandAll, setLastExpandAll] = useState(expandAll)
  const [lastCollapseAll, setLastCollapseAll] = useState(collapseAll)

  if (expandAll !== lastExpandAll) {
    setLastExpandAll(expandAll)
    setExpanded(true)
  }
  if (collapseAll !== lastCollapseAll) {
    setLastCollapseAll(collapseAll)
    setExpanded(false)
  }

  const handleCopyPath = useCallback(() => {
    onCopyPath(path)
  }, [onCopyPath, path])

  const isObj = isObject(value)
  const isArr = isArray(value)
  const isExpandable = isObj || isArr

  const comma = isLast ? '' : ','

  // Filter out non-matching nodes during search
  if (searchTerm && !hasMatchInSubtree(keyName, value, searchTerm)) {
    return null
  }

  const isHighlighted = matchesSearch(keyName, value, searchTerm)

  const copyButton = (
    <button
      onClick={handleCopyPath}
      className="ml-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded shrink-0"
      title={`Copy path: ${path || '(root)'}`}
    >
      copy
    </button>
  )

  const keyLabel = keyName !== null ? (
    <span className="text-gray-700 dark:text-gray-300 shrink-0">
      &quot;{keyName}&quot;:{' '}
    </span>
  ) : null

  const highlightClass = isHighlighted ? 'bg-yellow-100 dark:bg-yellow-900/30 rounded' : ''

  if (!isExpandable) {
    const { text, colorClass } = renderValue(value)
    return (
      <div className={`pl-4 flex items-start font-mono text-sm leading-6 group ${highlightClass}`}>
        {keyLabel}
        <span className={colorClass}>{text}</span>
        <span className="text-gray-400 dark:text-gray-500">{comma}</span>
        {copyButton}
      </div>
    )
  }

  const entries = isArr
    ? (value as JsonArray).map((item, i) => ({ key: String(i), value: item }))
    : Object.entries(value as JsonObject).map(([k, v]) => ({ key: k, value: v }))

  const count = entries.length
  const openBracket = isArr ? '[' : '{'
  const closeBracket = isArr ? ']' : '}'
  const summary = isArr ? `${count} item${count !== 1 ? 's' : ''}` : `${count} key${count !== 1 ? 's' : ''}`

  return (
    <div>
      <div className={`${depth > 0 ? 'pl-4' : ''} flex items-start font-mono text-sm leading-6 group ${highlightClass}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-4 h-6 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <span className={`inline-block transition-transform text-xs ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
        {keyLabel}
        {!expanded ? (
          <>
            <span className="text-gray-600 dark:text-gray-400">
              {openBracket}
              <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">
                {summary}
              </span>
              {closeBracket}
            </span>
            <span className="text-gray-400 dark:text-gray-500">{comma}</span>
          </>
        ) : (
          <span className="text-gray-600 dark:text-gray-400">{openBracket}</span>
        )}
        {copyButton}
      </div>
      {expanded && (
        <div className={depth > 0 ? 'pl-4' : ''}>
          {entries.map((entry, i) => {
            const childPath = isArr
              ? `${path}[${entry.key}]`
              : path
                ? `${path}.${entry.key}`
                : entry.key
            return (
              <TreeNode
                key={entry.key}
                keyName={isArr ? null : entry.key}
                value={entry.value}
                path={childPath}
                depth={depth + 1}
                searchTerm={searchTerm}
                onCopyPath={onCopyPath}
                expandAll={expandAll}
                collapseAll={collapseAll}
                isLast={i === entries.length - 1}
              />
            )
          })}
          <div className="pl-4 font-mono text-sm leading-6 text-gray-600 dark:text-gray-400">
            {closeBracket}
            <span className="text-gray-400 dark:text-gray-500">{comma}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function JsonTree({
  data,
  searchTerm,
  onCopyPath,
  expandAll,
  collapseAll,
}: JsonTreeProps) {
  return (
    <div className="overflow-x-auto py-2">
      <TreeNode
        keyName={null}
        value={data}
        path=""
        depth={0}
        searchTerm={searchTerm}
        onCopyPath={onCopyPath}
        expandAll={expandAll}
        collapseAll={collapseAll}
        isLast={true}
      />
    </div>
  )
}
