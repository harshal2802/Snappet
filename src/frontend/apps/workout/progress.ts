import type { WeightUnit, WorkoutSession } from './types'

export function toKg(weight: number, unit: WeightUnit | undefined): number {
  return unit === 'lb' ? weight * 0.453592 : weight
}

// Inverse of toKg: convert a kg figure (the common denominator we use for
// aggregates) back to the user's preferred display unit.
export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / 0.453592 : kg
}

// Display helper: convert kg → preferredUnit, round, and append the unit label.
// Used by every aggregate surface (volume tiles, muscle balance, PR feed,
// volume sparkline, history cards) so flipping `snappet:workout:preferred-unit`
// flips every label.
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${Math.round(kgToUnit(kg, unit)).toLocaleString()} ${unit}`
}

// Just the number in the preferred unit (no label) — useful when the unit
// label is rendered separately, e.g. as a smaller suffix span.
export function formatWeightNumber(kg: number, unit: WeightUnit): string {
  return Math.round(kgToUnit(kg, unit)).toLocaleString()
}

// Best (heaviest) set across all of `history` for `exerciseId`, expressed
// in kg. "Best" = top weight × reps. Bodyweight sets (no `actualWeight`)
// fall back to a weight of 1 so the rep-only comparison stays sane within
// an exercise; for inter-exercise comparison this would be apples-and-
// oranges, but ExerciseProgress is per-exercise so it's fine.
export function topSetForExercise(
  history: WorkoutSession[],
  exerciseId: string,
): { bestKg: number; bestReps: number; prSessionStartedAt: number } | null {
  let bestScore = 0
  let bestKg = 0
  let bestReps = 0
  let prSessionStartedAt = 0
  for (const session of history) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId)
    if (!ex) continue
    for (const s of ex.sets) {
      if (!s.completedAt) continue
      const reps = s.actualReps ?? 0
      if (reps === 0) continue
      const weightKg = s.actualWeight ? toKg(s.actualWeight, s.weightUnit) : 1
      const score = weightKg * reps
      if (score > bestScore) {
        bestScore = score
        bestKg = s.actualWeight ? weightKg : 0  // 0 surfaces as "—" for bodyweight
        bestReps = reps
        prSessionStartedAt = session.startedAt
      }
    }
  }
  return bestScore > 0
    ? { bestKg, bestReps, prSessionStartedAt }
    : null
}

export function totalVolumeForExercise(
  history: WorkoutSession[],
  exerciseId: string,
): number {
  let total = 0
  for (const session of history) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId)
    if (!ex) continue
    for (const s of ex.sets) {
      if (s.completedAt && s.actualReps && s.actualWeight) {
        total += toKg(s.actualWeight, s.weightUnit) * s.actualReps
      }
    }
  }
  return Math.round(total)
}

export function sessionCountForExercise(
  history: WorkoutSession[],
  exerciseId: string,
): number {
  let n = 0
  for (const session of history) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId)
    if (!ex) continue
    if (ex.sets.some((s) => s.completedAt)) n++
  }
  return n
}
