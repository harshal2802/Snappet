import { useState, useCallback, useEffect } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import JsonTree from './JsonTree'
import JsonDiff from './JsonDiff'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'
import type { AppMode, JsonValue } from './types'

const EXAMPLE_JSON = `{
  "name": "John Doe",
  "age": 30,
  "active": true,
  "address": {
    "street": "123 Main St",
    "city": "Springfield"
  },
  "hobbies": ["reading", "coding", "hiking"],
  "score": null
}`

const DIFF_ORIGINAL = `{
  "name": "John",
  "age": 30,
  "city": "NYC"
}`

const DIFF_MODIFIED = `{
  "name": "Jane",
  "age": 30,
  "country": "US"
}`

function parseJsonSafe(text: string): { value: JsonValue; error: string | null } {
  if (!text.trim()) return { value: null, error: null }
  try {
    const value = JSON.parse(text) as JsonValue
    return { value, error: null }
  } catch (err) {
    const message = err instanceof SyntaxError ? err.message : 'Invalid JSON'
    return { value: null, error: message }
  }
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function minifyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text))
  } catch {
    return text
  }
}

const MODE_BTN_BASE =
  'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const MODE_BTN_ACTIVE =
  'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
const MODE_BTN_INACTIVE =
  'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

export default function JsonExplorer() {
  // Persisted state
  const [mode, setMode] = useLocalStorage<AppMode>('snappet:json-explorer:mode', 'explorer')
  const [explorerInput, setExplorerInput] = useLocalStorage('snappet:json-explorer:input', '')
  const [diffOriginal, setDiffOriginal] = useLocalStorage('snappet:json-explorer:diffOriginal', '')
  const [diffModified, setDiffModified] = useLocalStorage('snappet:json-explorer:diffModified', '')
  const [searchTerm, setSearchTerm] = useLocalStorage('snappet:json-explorer:search', '')

  // Ephemeral state
  const [expandAll, setExpandAll] = useState(0)
  const [collapseAll, setCollapseAll] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  // Parse results
  const explorerParsed = parseJsonSafe(explorerInput)
  const origParsed = parseJsonSafe(diffOriginal)
  const modParsed = parseJsonSafe(diffModified)

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleCopyPath = useCallback((path: string) => {
    const copyText = path || '(root)'
    navigator.clipboard.writeText(copyText).then(() => {
      setToast(`Copied: ${copyText}`)
    }).catch(() => {
      setToast('Failed to copy')
    })
  }, [])

  function handleReset() {
    setMode('explorer')
    setExplorerInput('')
    setDiffOriginal('')
    setDiffModified('')
    setSearchTerm('')
    setExpandAll(0)
    setCollapseAll(0)
  }

  function handleFormat() {
    setExplorerInput(formatJson(explorerInput))
  }

  function handleMinify() {
    setExplorerInput(minifyJson(explorerInput))
  }

  function handleCopyInput() {
    if (!explorerInput) return
    navigator.clipboard.writeText(explorerInput).then(
      () => setToast('Copied JSON to clipboard'),
      () => setToast('Failed to copy'),
    )
  }

  const hasExplorerData = explorerInput.trim() !== '' && explorerParsed.error === null && explorerParsed.value !== null
  const hasDiffData =
    diffOriginal.trim() !== '' &&
    diffModified.trim() !== '' &&
    origParsed.error === null &&
    modParsed.error === null &&
    origParsed.value !== null &&
    modParsed.value !== null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            JSON Explorer
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Format, explore, and diff JSON data with a collapsible tree view.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="json-explorer" steps={tourSteps} />
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-fit" data-tour="mode">
        <button
          onClick={() => setMode('explorer')}
          aria-pressed={mode === 'explorer'}
          className={`${MODE_BTN_BASE} ${mode === 'explorer' ? MODE_BTN_ACTIVE : MODE_BTN_INACTIVE}`}
        >
          Explorer
        </button>
        <button
          onClick={() => setMode('diff')}
          aria-pressed={mode === 'diff'}
          className={`${MODE_BTN_BASE} ${mode === 'diff' ? MODE_BTN_ACTIVE : MODE_BTN_INACTIVE}`}
        >
          Diff
        </button>
      </div>

      {/* Explorer Mode */}
      {mode === 'explorer' && (
        <>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
            {/* Textarea */}
            <textarea
              value={explorerInput}
              onChange={(e) => setExplorerInput(e.target.value)}
              placeholder={EXAMPLE_JSON}
              rows={10}
              data-tour="input"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              spellCheck={false}
            />

            {/* Action buttons + counts */}
            <div className="flex flex-wrap items-center gap-2" data-tour="toolbar">
              <button
                onClick={handleFormat}
                disabled={!explorerInput.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Format
              </button>
              <button
                onClick={handleMinify}
                disabled={!explorerInput.trim()}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Minify
              </button>
              <button
                onClick={handleCopyInput}
                disabled={!explorerInput}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Copy
              </button>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-mono tabular-nums">
                {explorerInput.length.toLocaleString()} chars ·{' '}
                {explorerInput === '' ? 0 : explorerInput.split('\n').length} lines
              </span>
            </div>

            {/* Error display */}
            {explorerInput.trim() !== '' && explorerParsed.error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Invalid JSON
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">
                  {explorerParsed.error}
                </p>
              </div>
            )}
          </div>

          {/* Tree view */}
          {hasExplorerData && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
              {/* Tree controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setExpandAll((c) => c + 1)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={() => setCollapseAll((c) => c + 1)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Collapse All
                  </button>
                </div>
                <div className="relative flex-1 w-full sm:w-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search keys or values..."
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Tree */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-2 overflow-x-auto">
                <JsonTree
                  data={explorerParsed.value}
                  searchTerm={searchTerm}
                  onCopyPath={handleCopyPath}
                  expandAll={expandAll}
                  collapseAll={collapseAll}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Diff Mode */}
      {mode === 'diff' && (
        <>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Original
                </label>
                <textarea
                  value={diffOriginal}
                  onChange={(e) => setDiffOriginal(e.target.value)}
                  placeholder={DIFF_ORIGINAL}
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  spellCheck={false}
                />
                {diffOriginal.trim() !== '' && origParsed.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                    {origParsed.error}
                  </p>
                )}
              </div>

              {/* Modified */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Modified
                </label>
                <textarea
                  value={diffModified}
                  onChange={(e) => setDiffModified(e.target.value)}
                  placeholder={DIFF_MODIFIED}
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  spellCheck={false}
                />
                {diffModified.trim() !== '' && modParsed.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                    {modParsed.error}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Diff results */}
          {hasDiffData && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Differences
              </h2>
              <JsonDiff original={origParsed.value} modified={modParsed.value} />
            </div>
          )}

          {/* Prompt when both empty */}
          {!hasDiffData && !origParsed.error && !modParsed.error && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 shadow-sm text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Paste JSON in both fields to see the structural diff.
              </p>
            </div>
          )}
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
