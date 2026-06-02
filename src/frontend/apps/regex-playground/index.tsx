import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { explainPattern } from './explainer'
import { COMMON_PATTERNS } from './patterns'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'
import type {
  RegexFlag,
  MatchResult,
  CaptureGroup,
  CommonPattern,
} from './types'

/* ── Tailwind class constants ── */
const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm'

const FLAG_BASE =
  'px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

const FLAG_ACTIVE =
  'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'

const FLAG_INACTIVE =
  'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

const MATCH_COLORS = [
  'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100',
  'bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-100',
  'bg-purple-200 dark:bg-purple-800/60 text-purple-900 dark:text-purple-100',
  'bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100',
  'bg-rose-200 dark:bg-rose-800/60 text-rose-900 dark:text-rose-100',
  'bg-teal-200 dark:bg-teal-800/60 text-teal-900 dark:text-teal-100',
]

const GROUP_COLORS = [
  'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
  'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
  'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200',
]

const ALL_FLAGS: RegexFlag[] = ['g', 'i', 'm', 's']

const FLAG_LABELS: Record<RegexFlag, string> = {
  g: 'global',
  i: 'case-insensitive',
  m: 'multiline',
  s: 'dotAll',
}

/* ── Defaults ── */
const DEFAULTS = {
  pattern: '(\\d{4})-(\\d{2})-(\\d{2})',
  flags: ['g'] as RegexFlag[],
  testString: 'Today is 2024-01-15 and tomorrow is 2024-01-16.',
}

/* ── Helpers ── */

function buildRegex(
  pattern: string,
  flags: RegexFlag[]
): { regex: RegExp; error: null } | { regex: null; error: string } {
  try {
    const regex = new RegExp(pattern, flags.join(''))
    return { regex, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid regex'
    return { regex: null, error: message }
  }
}

function findMatches(regex: RegExp, testString: string): MatchResult[] {
  const results: MatchResult[] = []
  if (!regex.global) {
    const m = regex.exec(testString)
    if (m) {
      results.push(matchFromExec(m))
    }
    return results
  }
  // Use matchAll for global
  const iter = testString.matchAll(regex)
  for (const m of iter) {
    results.push(matchFromExec(m))
  }
  return results
}

function matchFromExec(m: RegExpExecArray | RegExpMatchArray): MatchResult {
  const groups: CaptureGroup[] = []
  for (let g = 1; g < m.length; g++) {
    const namedGroups = m.groups ?? {}
    let name: string | null = null
    for (const [key, val] of Object.entries(namedGroups)) {
      if (val === m[g] && !groups.some((cg) => cg.name === key)) {
        name = key
        break
      }
    }
    groups.push({ index: g, name, value: m[g] ?? null })
  }
  return {
    fullMatch: m[0],
    startIndex: m.index ?? 0,
    endIndex: (m.index ?? 0) + m[0].length,
    groups,
  }
}

/** Build JSX spans for highlighted text */
function buildHighlightedSegments(
  testString: string,
  matches: MatchResult[]
): Array<{ text: string; matchIndex: number | null }> {
  if (matches.length === 0) {
    return [{ text: testString, matchIndex: null }]
  }

  const segments: Array<{ text: string; matchIndex: number | null }> = []
  let cursor = 0

  // Sort matches by start index to handle overlapping correctly
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex)

  for (let i = 0; i < sorted.length; i++) {
    const match = sorted[i]
    // Skip overlapping matches
    if (match.startIndex < cursor) continue

    if (match.startIndex > cursor) {
      segments.push({
        text: testString.slice(cursor, match.startIndex),
        matchIndex: null,
      })
    }
    segments.push({
      text: testString.slice(match.startIndex, match.endIndex),
      matchIndex: i,
    })
    cursor = match.endIndex
  }
  if (cursor < testString.length) {
    segments.push({ text: testString.slice(cursor), matchIndex: null })
  }
  return segments
}

/* ── Component ── */

export default function RegexPlayground() {
  const [pattern, setPattern] = useLocalStorage(
    'snappet:regex:pattern',
    DEFAULTS.pattern
  )
  const [flags, setFlags] = useLocalStorage<RegexFlag[]>(
    'snappet:regex:flags',
    DEFAULTS.flags
  )
  const [testString, setTestString] = useLocalStorage(
    'snappet:regex:testString',
    DEFAULTS.testString
  )
  const [showPatterns, setShowPatterns] = useState(false)

  function handleReset() {
    setPattern(DEFAULTS.pattern)
    setFlags(DEFAULTS.flags)
    setTestString(DEFAULTS.testString)
    setShowPatterns(false)
  }

  function toggleFlag(flag: RegexFlag) {
    setFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    )
  }

  function loadPattern(cp: CommonPattern) {
    setPattern(cp.pattern)
    setFlags(cp.flags)
    setTestString(cp.testString)
    setShowPatterns(false)
  }

  // Build regex
  const regexResult = useMemo(
    () => (pattern ? buildRegex(pattern, flags) : null),
    [pattern, flags]
  )

  // Find matches
  const matches = useMemo(() => {
    if (!regexResult || regexResult.error !== null) return []
    return findMatches(regexResult.regex, testString)
  }, [regexResult, testString])

  // Highlighted segments
  const segments = useMemo(
    () => buildHighlightedSegments(testString, matches),
    [testString, matches]
  )

  // Explain pattern
  const explanation = useMemo(
    () => (pattern ? explainPattern(pattern) : []),
    [pattern]
  )

  const error = regexResult?.error ?? null

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Regex Playground
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Test, debug, and understand regular expressions in real time.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="regex-playground" steps={tourSteps} />
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Pattern input + flags */}
      <div className={CARD} data-tour="pattern">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pattern
          </label>
          <div className="flex items-center gap-2">
            <span className="text-lg text-gray-400 dark:text-gray-500 font-mono">
              /
            </span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Enter regex pattern..."
              spellCheck={false}
              className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <span className="text-lg text-gray-400 dark:text-gray-500 font-mono">
              /{flags.join('')}
            </span>
          </div>

          {/* Flag toggles */}
          <div className="flex flex-wrap gap-2" data-tour="flags">
            {ALL_FLAGS.map((flag) => (
              <button
                key={flag}
                onClick={() => toggleFlag(flag)}
                aria-pressed={flags.includes(flag)}
                title={FLAG_LABELS[flag]}
                className={`${FLAG_BASE} ${flags.includes(flag) ? FLAG_ACTIVE : FLAG_INACTIVE}`}
              >
                {flag}
              </button>
            ))}
            <span className="flex items-center text-xs text-gray-400 dark:text-gray-500 ml-1">
              {flags.map((f) => FLAG_LABELS[f]).join(', ') || 'no flags'}
            </span>
          </div>

          {/* Error display */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-mono">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Test string with highlighted matches */}
      <div className={CARD} data-tour="test">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Test String
            </label>
            {!error && pattern && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {matches.length === 0
                  ? 'No matches'
                  : `${matches.length} match${matches.length === 1 ? '' : 'es'} found`}
              </span>
            )}
          </div>
          <textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="Enter test string..."
            rows={4}
            spellCheck={false}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-y"
          />

          {/* Highlighted preview */}
          {pattern && !error && testString && (
            <div className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-sm whitespace-pre-wrap break-all leading-relaxed">
              {segments.map((seg, idx) =>
                seg.matchIndex !== null ? (
                  <span
                    key={idx}
                    className={`rounded px-0.5 py-0.5 ${MATCH_COLORS[seg.matchIndex % MATCH_COLORS.length]}`}
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span
                    key={idx}
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {seg.text}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Match Details + Pattern Explanation — two columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="details">
        {/* Match Details */}
        <div className={CARD}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            Match Details
          </h2>
          {matches.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {pattern
                ? error
                  ? 'Fix the pattern error above.'
                  : 'No matches found.'
                : 'Enter a pattern to see matches.'}
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {matches.map((match, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${MATCH_COLORS[idx % MATCH_COLORS.length]}`}
                      >
                        {idx + 1}
                      </span>
                      <code className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
                        {match.fullMatch}
                      </code>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      [{match.startIndex}–{match.endIndex})
                    </span>
                  </div>
                  {match.groups.length > 0 && (
                    <div className="space-y-1 pl-8">
                      {match.groups.map((group) => (
                        <div
                          key={group.index}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded font-mono font-medium ${GROUP_COLORS[(group.index - 1) % GROUP_COLORS.length]}`}
                          >
                            {group.name
                              ? group.name
                              : `Group ${group.index}`}
                          </span>
                          <code className="font-mono text-gray-700 dark:text-gray-300">
                            {group.value !== null ? group.value : '(not captured)'}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pattern Explanation */}
        <div className={CARD}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            Pattern Explanation
          </h2>
          {explanation.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Enter a pattern to see its breakdown.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {explanation.map((tok, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-sm"
                >
                  <code className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-mono font-semibold shrink-0">
                    {tok.token}
                  </code>
                  <span className="text-gray-600 dark:text-gray-400 pt-0.5">
                    {tok.description}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Common Patterns Library */}
      <div className={CARD} data-tour="library">
        <button
          onClick={() => setShowPatterns((prev) => !prev)}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Common Patterns
          </h2>
          <span className="text-gray-400 dark:text-gray-500 text-sm">
            {showPatterns ? '▲ Hide' : '▼ Show'}
          </span>
        </button>
        {showPatterns && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {COMMON_PATTERNS.map((cp) => (
              <PatternCard
                key={cp.name}
                pattern={cp}
                onUse={() => loadPattern(cp)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Pattern card sub-component ── */

function PatternCard({
  pattern,
  onUse,
}: {
  pattern: CommonPattern
  onUse: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {pattern.name}
        </span>
        <button
          onClick={onUse}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Use
        </button>
      </div>
      <code className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
        {pattern.pattern}
      </code>
    </div>
  )
}
