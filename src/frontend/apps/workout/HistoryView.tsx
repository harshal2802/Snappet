import { useMemo, useState } from 'react'
import ExerciseImage from './ExerciseImage'
import SessionDetail from './SessionDetail'
import { formatWeightNumber } from './progress'
import { getDisplayName } from './utils'
import type { Exercise, WeightUnit, WorkoutSession } from './types'

interface HistoryViewProps {
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  preferredUnit: WeightUnit
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${total}s`
}

function toKg(weight: number, unit: WeightUnit | undefined): number {
  return unit === 'lb' ? weight * 0.453592 : weight
}

function sessionVolumeKg(s: WorkoutSession): number {
  let total = 0
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.completedAt && set.actualReps && set.actualWeight) {
        total += toKg(set.actualWeight, set.weightUnit) * set.actualReps
      }
    }
  }
  return Math.round(total)
}

function sessionSets(s: WorkoutSession): { done: number; target: number } {
  let done = 0
  let target = 0
  for (const ex of s.exercises) {
    target += ex.targetSets
    for (const set of ex.sets) if (set.completedAt) done++
  }
  return { done, target }
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleExport(history: WorkoutSession[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessions: history,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `snappet-workout-history-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export default function HistoryView({ history, exerciseById, preferredUnit }: HistoryViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => (selectedId ? history.find((s) => s.id === selectedId) ?? null : null),
    [history, selectedId],
  )

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center space-y-2">
        <p className="text-3xl">📓</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No completed workouts yet. Start a routine to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {history.length} completed workout{history.length === 1 ? '' : 's'}
        </h2>
        <button
          onClick={() => handleExport(history)}
          title="Download all history as JSON"
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          ↓ Export JSON
        </button>
      </div>

      {/* Body — two columns on md+ when a card is selected */}
      <div className={`grid gap-4 ${selected ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]' : ''}`}>
        {/* List */}
        <div className="space-y-2">
          {history.map((s) => {
            const sets = sessionSets(s)
            const vol = sessionVolumeKg(s)
            const duration = (s.completedAt ?? s.startedAt) - s.startedAt
            const thumbs = s.exercises.slice(0, 3)
            const moreCount = Math.max(0, s.exercises.length - 3)
            const isActive = s.id === selectedId

            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                aria-pressed={isActive}
                className={`w-full text-left rounded-xl border p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {s.routineName}
                  </p>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {formatShortDate(s.startedAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatDuration(duration)} · {sets.done}/{sets.target} sets
                  {vol > 0 ? ` · ${formatWeightNumber(vol, preferredUnit)} ${preferredUnit}` : ''}
                </p>
                {thumbs.length > 0 && (
                  <div className="flex items-center gap-1 pt-2">
                    {thumbs.map((re, i) => {
                      const ex = exerciseById.get(re.exerciseId)
                      const label = getDisplayName(re, ex)
                      return (
                        <div
                          key={`${re.exerciseId}-${i}`}
                          className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden"
                          title={label}
                        >
                          {ex?.images[0] && (
                            <ExerciseImage
                              path={ex.images[0]}
                              alt={label}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      )
                    })}
                    {moreCount > 0 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        +{moreCount} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Desktop side-pane */}
        {selected && (
          <div className="hidden md:block sticky top-[120px] self-start h-[calc(100vh-140px)]">
            <SessionDetail
              session={selected}
              history={history}
              exerciseById={exerciseById}
              preferredUnit={preferredUnit}
              onClose={() => setSelectedId(null)}
              inline
            />
          </div>
        )}
      </div>

      {/* Mobile modal */}
      {selected && (
        <div className="md:hidden">
          <SessionDetail
            session={selected}
            history={history}
            exerciseById={exerciseById}
            preferredUnit={preferredUnit}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  )
}
