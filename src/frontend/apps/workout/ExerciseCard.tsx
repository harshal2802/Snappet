import type { Exercise, ExerciseLevel } from './types'
import ExerciseImage from './ExerciseImage'

interface ExerciseCardProps {
  exercise: Exercise
  onClick: () => void
  isActive?: boolean
}

const LEVEL_PILL: Record<ExerciseLevel, string> = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  intermediate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  expert: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

export default function ExerciseCard({ exercise, onClick, isActive }: ExerciseCardProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className={`w-full text-left flex items-stretch gap-3 p-2.5 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isActive
          ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
    >
      <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
        {exercise.images[0] && (
          <ExerciseImage
            path={exercise.images[0]}
            alt={exercise.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
          {exercise.name}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${LEVEL_PILL[exercise.level]}`}>
            {exercise.level}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
            {exercise.equipment}
          </span>
        </div>
        {exercise.primaryMuscles.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {exercise.primaryMuscles.join(', ')}
          </p>
        )}
      </div>
    </button>
  )
}
