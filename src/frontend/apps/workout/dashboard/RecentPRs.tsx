import { recentDistinctPRs } from './data'
import { getDisplayName } from '../utils'
import type { Exercise, WorkoutSession } from '../types'

interface RecentPRsProps {
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  onOpen: (exerciseId: string) => void
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function RecentPRs({ history, exerciseById, onOpen }: RecentPRsProps) {
  const prs = recentDistinctPRs(history, 5)

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Recent PRs
      </h3>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {prs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No personal records yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {prs.map((pr) => {
              const ex = exerciseById.get(pr.exerciseId)
              const label = getDisplayName({ exerciseId: pr.exerciseId }, ex)
              return (
                <li key={pr.exerciseId}>
                  <button
                    onClick={() => onOpen(pr.exerciseId)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                  >
                    <span className="text-amber-500 dark:text-amber-400 text-base shrink-0">★</span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {label}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                      {pr.bestKg > 0 ? `${Math.round(pr.bestKg)} kg × ${pr.bestReps}` : `${pr.bestReps} reps`}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-14 text-right">
                      {formatShortDate(pr.prSessionStartedAt)}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600 text-sm shrink-0">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
