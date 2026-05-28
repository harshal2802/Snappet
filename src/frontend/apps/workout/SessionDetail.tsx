import { useEffect } from 'react'
import ExerciseImage from './ExerciseImage'
import ExerciseProgress from './ExerciseProgress'
import type { Exercise, SessionExercise, WeightUnit, WorkoutSession } from './types'

interface SessionDetailProps {
  session: WorkoutSession
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  onClose: () => void
  /** When true (desktop), renders inline (no backdrop). Mirrors ExerciseDetail. */
  inline?: boolean
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function toKg(weight: number, unit: WeightUnit | undefined): number {
  return unit === 'lb' ? weight * 0.453592 : weight
}

function setsCompleted(session: WorkoutSession): { done: number; target: number } {
  let done = 0
  let target = 0
  for (const ex of session.exercises) {
    target += ex.targetSets
    for (const s of ex.sets) {
      if (s.completedAt) done += 1
    }
  }
  return { done, target }
}

function totalVolumeKg(session: WorkoutSession): number {
  let total = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.completedAt && s.actualReps && s.actualWeight) {
        total += toKg(s.actualWeight, s.weightUnit) * s.actualReps
      }
    }
  }
  return Math.round(total)
}

function exerciseInHistoryCount(history: WorkoutSession[], exerciseId: string): number {
  let n = 0
  for (const s of history) {
    if (s.exercises.some((e) => e.exerciseId === exerciseId)) n++
  }
  return n
}

interface ExerciseBlockProps {
  ex: SessionExercise
  exerciseMeta: Exercise | undefined
  history: WorkoutSession[]
}

function ExerciseBlock({ ex, exerciseMeta, history }: ExerciseBlockProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="shrink-0 w-12 h-12 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {exerciseMeta?.images[0] && (
            <ExerciseImage
              path={exerciseMeta.images[0]}
              alt={exerciseMeta.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {exerciseMeta?.name ?? ex.exerciseId}
            </p>
            {ex.skipped && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Skipped
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Target: {ex.targetSets} × {ex.targetReps}
            {ex.targetWeight !== undefined && ex.targetWeight > 0
              ? ` @ ${ex.targetWeight}${ex.targetWeightUnit ?? 'kg'}`
              : ''}
          </p>
        </div>
      </div>

      <ul className="text-xs font-mono tabular-nums space-y-0.5">
        {ex.sets.map((s, i) => {
          const done = s.completedAt !== undefined
          return (
            <li
              key={i}
              className={`flex justify-between px-2 py-1 rounded ${
                done
                  ? 'bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span>Set {i + 1}</span>
              <span>
                {done
                  ? `${s.actualReps ?? '—'} reps${
                      s.actualWeight !== undefined && s.actualWeight > 0
                        ? ` × ${s.actualWeight}${s.weightUnit ?? 'kg'}`
                        : ''
                    }`
                  : ex.skipped
                    ? 'skipped'
                    : 'not done'}
              </span>
            </li>
          )
        })}
      </ul>

      {exerciseInHistoryCount(history, ex.exerciseId) >= 2 && (
        <ExerciseProgress exerciseId={ex.exerciseId} history={history} />
      )}
    </div>
  )
}

export default function SessionDetail({
  session,
  history,
  exerciseById,
  onClose,
  inline,
}: SessionDetailProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const duration = (session.completedAt ?? session.startedAt) - session.startedAt
  const sets = setsCompleted(session)
  const volume = totalVolumeKg(session)
  const exercisesDone = session.exercises.filter(
    (e) => e.skipped || e.sets.every((s) => s.completedAt),
  ).length
  const dateLabel = new Date(session.startedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const body = (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {session.routineName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Duration
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatDuration(duration)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sets
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {sets.done}
              <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                {' '}/ {sets.target}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Exercises
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {exercisesDone}
              <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                {' '}/ {session.exercises.length}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Volume
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {volume.toLocaleString()}
              <span className="text-sm font-medium text-gray-400 dark:text-gray-500"> kg</span>
            </p>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-2">
          {session.exercises.map((ex, i) => (
            <ExerciseBlock
              key={`${ex.exerciseId}-${i}`}
              ex={ex}
              exerciseMeta={exerciseById.get(ex.exerciseId)}
              history={history}
            />
          ))}
        </div>
      </div>
    </div>
  )

  if (inline) {
    return <div className="h-full">{body}</div>
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl sm:max-h-[90vh] flex">{body}</div>
    </div>
  )
}
