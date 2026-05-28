import type { Exercise, Routine, RoutineDefaults } from './types'

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function mode<T extends string | number>(values: Array<T | undefined>): T | undefined {
  const counts = new Map<T, number>()
  for (const v of values) {
    if (v === undefined) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best: T | undefined
  let bestN = 0
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v
      bestN = n
    }
  }
  return best
}

export function deriveDefaults(routine: Routine): RoutineDefaults {
  if (routine.exercises.length === 0) return {}
  return {
    sets: median(routine.exercises.map((e) => e.sets)),
    reps: mode(routine.exercises.map((e) => e.reps)),
    restSeconds: median(routine.exercises.map((e) => e.restSeconds)),
    weightUnit: mode(routine.exercises.map((e) => e.weightUnit)),
  }
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

