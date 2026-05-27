import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

interface State {
  startedAt: number | null   // epoch ms; non-null = running
  elapsedAtPause: number     // accumulated ms while paused
  laps: number[]             // each entry is total elapsed (ms) at lap moment
}

const INITIAL_STATE: State = {
  startedAt: null,
  elapsedAtPause: 0,
  laps: [],
}

const ONE_HOUR_MS = 60 * 60 * 1000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Format ms as MM:SS.cc, or HH:MM:SS.cc when total ≥ 1 hour.
 * Centiseconds = floor((ms % 1000) / 10).
 */
function formatTime(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSeconds = Math.floor(safe / 1000)
  const cs = Math.floor((safe % 1000) / 10)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  if (safe >= ONE_HOUR_MS) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad2(cs)}`
  }
  return `${pad2(totalMinutes)}:${pad2(seconds)}.${pad2(cs)}`
}

function vibrate(ms: number): void {
  if (typeof navigator !== 'undefined') {
    navigator.vibrate?.(ms)
  }
}

interface LapRow {
  index: number       // 1-based lap number
  split: number       // ms; this lap minus previous lap
  total: number       // ms; cumulative at lap moment
  isBest: boolean
  isWorst: boolean
}

function computeLapRows(laps: number[]): LapRow[] {
  if (laps.length === 0) return []
  const splits: number[] = []
  for (let i = 0; i < laps.length; i++) {
    const prev = i === 0 ? 0 : laps[i - 1]
    splits.push(laps[i] - prev)
  }
  const bestSplit = Math.min(...splits)
  const worstSplit = Math.max(...splits)
  // Only flag worst when we have at least 3 laps, per spec.
  const showExtremes = laps.length >= 2
  const showWorst = laps.length >= 3
  return laps.map((total, i) => ({
    index: i + 1,
    split: splits[i],
    total,
    isBest: showExtremes && splits[i] === bestSplit && bestSplit !== worstSplit,
    isWorst: showWorst && splits[i] === worstSplit && bestSplit !== worstSplit,
  }))
}

export default function Stopwatch() {
  const [state, setState] = useLocalStorage<State>(
    'snappet:stopwatch:state',
    INITIAL_STATE,
  )
  const [now, setNow] = useState<number>(() => Date.now())

  const isRunning = state.startedAt !== null
  const isPaused = state.startedAt === null && state.elapsedAtPause > 0

  const currentElapsed = isRunning
    ? state.elapsedAtPause + (now - (state.startedAt ?? now))
    : state.elapsedAtPause

  // Tick — faster than 60fps so centiseconds update smoothly. Only while
  // running. The interval does NOT produce the value; it just forces a
  // re-render so we re-read Date.now().
  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setNow(Date.now()), 31)
    return () => window.clearInterval(id)
  }, [isRunning])

  function handleStart() {
    vibrate(10)
    setState((prev) => ({
      ...prev,
      startedAt: Date.now(),
    }))
  }

  function handleStop() {
    vibrate(10)
    setState((prev) => {
      if (prev.startedAt === null) return prev
      const addition = Date.now() - prev.startedAt
      return {
        ...prev,
        startedAt: null,
        elapsedAtPause: prev.elapsedAtPause + addition,
      }
    })
  }

  function handleResume() {
    vibrate(10)
    setState((prev) => ({
      ...prev,
      startedAt: Date.now(),
    }))
  }

  function handleReset() {
    setState(INITIAL_STATE)
  }

  function handleLap() {
    vibrate(10)
    setState((prev) => {
      if (prev.startedAt === null) return prev
      const elapsed = prev.elapsedAtPause + (Date.now() - prev.startedAt)
      return {
        ...prev,
        laps: [...prev.laps, elapsed],
      }
    })
  }

  const lapRows = useMemo(() => computeLapRows(state.laps), [state.laps])
  // Newest first for display
  const lapRowsDisplay = useMemo(() => [...lapRows].reverse(), [lapRows])

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Stopwatch
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Time anything with lap splits — workouts, cooking, intervals.
          </p>
        </div>
      </div>

      {/* Big timer display */}
      <div
        className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-8 px-4 flex items-center justify-center"
        aria-live="polite"
      >
        <span className="text-7xl font-mono tabular-nums text-gray-900 dark:text-gray-100">
          {formatTime(currentElapsed)}
        </span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        {!isRunning && !isPaused && (
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 h-14 rounded-xl bg-blue-600 dark:bg-blue-500 text-white text-base font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Start
          </button>
        )}

        {isRunning && (
          <>
            <button
              type="button"
              onClick={handleLap}
              className="flex-1 h-14 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-base font-semibold hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Lap
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 h-14 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-base font-semibold hover:bg-gray-700 dark:hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
            >
              Stop
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 h-14 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-base font-semibold hover:border-red-400 dark:hover:border-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="flex-1 h-14 rounded-xl bg-blue-600 dark:bg-blue-500 text-white text-base font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Resume
            </button>
          </>
        )}
      </div>

      {/* Lap list */}
      {lapRowsDisplay.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <span>Lap</span>
            <span>Split</span>
            <span>Total</span>
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
            {lapRowsDisplay.map((row) => {
              const splitClass = row.isBest
                ? 'text-green-600 dark:text-green-400'
                : row.isWorst
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-700 dark:text-gray-200'
              return (
                <li
                  key={row.index}
                  className="px-4 py-2.5 flex items-center justify-between text-sm font-mono tabular-nums"
                >
                  <span className="text-gray-500 dark:text-gray-400 w-12">
                    #{row.index}
                  </span>
                  <span className={`${splitClass} font-semibold`}>
                    {formatTime(row.split)}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {formatTime(row.total)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
