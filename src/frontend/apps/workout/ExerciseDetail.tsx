import { useEffect } from 'react'
import type { Exercise, ExerciseLevel, Muscle } from './types'
import ExerciseImage from './ExerciseImage'

interface ExerciseDetailProps {
  exercise: Exercise
  onClose: () => void
  /** When true (desktop), renders inline (no backdrop). */
  inline?: boolean
}

const LEVEL_PILL: Record<ExerciseLevel, string> = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  intermediate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  expert: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

function MusclePill({ muscle, primary }: { muscle: Muscle; primary: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        primary
          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
          : 'border border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400'
      }`}
    >
      {muscle}
    </span>
  )
}

export default function ExerciseDetail({ exercise, onClose, inline }: ExerciseDetailProps) {
  // Close on Escape (both modes)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const body = (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
          {exercise.name}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Image pair */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {exercise.images.map((path, i) => (
            <div
              key={path}
              className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-[4/3] relative"
            >
              <ExerciseImage
                path={path}
                alt={`${exercise.name} — ${i === 0 ? 'start' : 'end'}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 left-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
                {i === 0 ? 'Start' : 'End'}
              </span>
            </div>
          ))}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 capitalize">
            {exercise.category}
          </span>
          <span className={`px-2 py-0.5 rounded ${LEVEL_PILL[exercise.level]}`}>
            {exercise.level}
          </span>
          <span className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
            {exercise.equipment}
          </span>
          {exercise.force && (
            <span className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
              {exercise.force}
            </span>
          )}
          {exercise.mechanic && (
            <span className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
              {exercise.mechanic}
            </span>
          )}
        </div>

        {/* Muscles */}
        {(exercise.primaryMuscles.length > 0 || exercise.secondaryMuscles.length > 0) && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Muscles
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {exercise.primaryMuscles.map((m) => (
                <MusclePill key={`p-${m}`} muscle={m} primary />
              ))}
              {exercise.secondaryMuscles.map((m) => (
                <MusclePill key={`s-${m}`} muscle={m} primary={false} />
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {exercise.instructions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              How to do it
            </h3>
            <ol className="list-decimal list-outside ml-5 space-y-1.5 text-sm text-gray-800 dark:text-gray-200">
              {exercise.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Attribution */}
        <p className="pt-2 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
          Exercise data:{' '}
          <a
            href="https://github.com/yuhonas/free-exercise-db"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 dark:hover:text-blue-400"
          >
            yuhonas/free-exercise-db
          </a>
        </p>
      </div>
    </div>
  )

  if (inline) {
    return <div className="h-full">{body}</div>
  }

  // Modal (mobile)
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
