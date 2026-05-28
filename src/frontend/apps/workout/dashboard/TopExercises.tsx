import { last30Days, topExercisesByFrequency } from './data'
import { getDisplayName } from '../utils'
import type { Exercise, WorkoutSession } from '../types'

interface TopExercisesProps {
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  now: number
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TopExercises({ history, exerciseById, now }: TopExercisesProps) {
  const { fromMs, toMs } = last30Days(now)
  const top = topExercisesByFrequency(history, fromMs, toMs, 5)

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Top exercises · last 30 days
      </h3>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {top.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No exercises completed in the last 30 days.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {top.map((entry) => {
              const ex = exerciseById.get(entry.exerciseId)
              const label = getDisplayName({ exerciseId: entry.exerciseId }, ex)
              return (
                <li
                  key={entry.exerciseId}
                  className="px-3 py-2.5 flex items-center gap-2"
                >
                  <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {label}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                    {entry.count} session{entry.count === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-20 text-right">
                    last: {formatShortDate(entry.lastDoneAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
