import { useMemo } from 'react'
import ConsistencyHeatmap from './dashboard/ConsistencyHeatmap'
import MuscleBalance from './dashboard/MuscleBalance'
import RecentPRs from './dashboard/RecentPRs'
import TopExercises from './dashboard/TopExercises'
import VolumeSparkline from './dashboard/VolumeSparkline'
import WeekSnapshot from './dashboard/WeekSnapshot'
import type { Exercise, WeightUnit, WorkoutSession } from './types'

interface DashboardProps {
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  preferredUnit: WeightUnit
  onOpenExercise: (exerciseId: string) => void
  onGoToRoutines: () => void
}

export default function Dashboard({
  history,
  exerciseById,
  preferredUnit,
  onOpenExercise,
  onGoToRoutines,
}: DashboardProps) {
  // Recompute time-windows each time history changes (e.g. session just saved).
  // Using a useMemo dep on history.length means widgets all share one "now".
  const now = useMemo(() => Date.now(), [history.length])

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center space-y-3 max-w-md mx-auto">
        <span className="text-4xl block">📊</span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          No workouts yet
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Complete a routine and your dashboard will fill in. Start with a
          starter routine or build your own.
        </p>
        <button
          onClick={onGoToRoutines}
          className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Go to Routines
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <WeekSnapshot history={history} now={now} preferredUnit={preferredUnit} />
      <ConsistencyHeatmap history={history} now={now} />
      <VolumeSparkline history={history} now={now} preferredUnit={preferredUnit} />
      <MuscleBalance
        history={history}
        exerciseById={exerciseById}
        now={now}
        preferredUnit={preferredUnit}
      />
      <RecentPRs
        history={history}
        exerciseById={exerciseById}
        preferredUnit={preferredUnit}
        onOpen={onOpenExercise}
      />
      <TopExercises history={history} exerciseById={exerciseById} now={now} />
    </div>
  )
}
