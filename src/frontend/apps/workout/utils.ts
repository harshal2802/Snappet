import type { Exercise } from './types'

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

// Resolve the label to show for a routine or session row. User override wins;
// otherwise fall back to the catalog name, then a sentinel for orphan rows.
export function getDisplayName(
  routineOrSessionExercise:
    | { exerciseId: string; displayName?: string }
    | undefined,
  exercise: Exercise | undefined,
): string {
  const override = routineOrSessionExercise?.displayName?.trim()
  if (override) return override
  if (exercise?.name) return exercise.name
  return `(${routineOrSessionExercise?.exerciseId ?? 'unknown'})`
}

