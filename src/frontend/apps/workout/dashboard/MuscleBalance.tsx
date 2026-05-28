import { last30Days, muscleVolume } from './data'
import type { Exercise, Muscle, WorkoutSession } from '../types'

interface MuscleBalanceProps {
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  now: number
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}

export default function MuscleBalance({ history, exerciseById, now }: MuscleBalanceProps) {
  const { fromMs, toMs } = last30Days(now)
  const m = muscleVolume(history, exerciseById, fromMs, toMs)
  const ranked: Array<{ muscle: Muscle; kg: number }> = Array.from(m.entries())
    .map(([muscle, kg]) => ({ muscle, kg }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 6)
  const max = ranked[0]?.kg ?? 0

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Muscle balance · last 30 days
      </h3>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
        {ranked.length === 0 || max === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
            Not enough weighted volume in the last 30 days.
          </p>
        ) : (
          <ul className="space-y-2">
            {ranked.map(({ muscle, kg }) => {
              const pct = Math.max(2, Math.round((kg / max) * 100))
              return (
                <li key={muscle} className="flex items-center gap-2 text-sm">
                  <span className="w-20 sm:w-24 shrink-0 text-gray-700 dark:text-gray-300 truncate">
                    {capitalize(muscle)}
                  </span>
                  <div
                    className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
                    role="meter"
                    aria-valuenow={Math.round(kg)}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(max)}
                    aria-label={`${capitalize(muscle)} volume`}
                  >
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right shrink-0 text-gray-500 dark:text-gray-400 tabular-nums text-xs">
                    {Math.round(kg).toLocaleString()} kg
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
