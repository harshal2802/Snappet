import type { Grade } from './types'

/** Map a (float) display_difficulty to the nearest difficulty_grades label. */
export function gradeLabel(grades: Grade[], difficulty: number): string {
  if (!grades.length) return String(Math.round(difficulty))
  const target = Math.round(difficulty)
  let best = grades[0]
  let bestDelta = Math.abs(best.difficulty - target)
  for (const g of grades) {
    const delta = Math.abs(g.difficulty - target)
    if (delta < bestDelta) {
      best = g
      bestDelta = delta
    }
  }
  return best.name
}
