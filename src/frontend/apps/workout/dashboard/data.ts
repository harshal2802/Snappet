import { toKg } from '../progress'
import type { Exercise, Muscle, WorkoutSession } from '../types'

// ── Date helpers (local timezone) ─────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ISO week start = Monday 00:00 local. JS getDay() returns 0=Sun..6=Sat.
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms))
  const dow = d.getDay()
  const shift = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + shift)
  return d.getTime()
}

export function isoDayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── Range helpers ─────────────────────────────────────────────────────────

export interface DateRange {
  fromMs: number
  toMs: number
}

export function thisWeekRange(now: number): DateRange {
  const fromMs = startOfWeek(now)
  return { fromMs, toMs: fromMs + WEEK_MS }
}

export function lastWeekRange(now: number): DateRange {
  const fromMs = startOfWeek(now) - WEEK_MS
  return { fromMs, toMs: fromMs + WEEK_MS }
}

export function last30Days(now: number): DateRange {
  return { fromMs: startOfDay(now - 30 * DAY_MS), toMs: now }
}

// ── Per-session helpers ───────────────────────────────────────────────────

export function sessionVolumeKg(session: WorkoutSession): number {
  let total = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.completedAt && s.actualReps && s.actualWeight) {
        total += toKg(s.actualWeight, s.weightUnit) * s.actualReps
      }
    }
  }
  return total
}

export function sessionsInRange(
  history: WorkoutSession[],
  fromMs: number,
  toMs: number,
): WorkoutSession[] {
  return history.filter((s) => s.startedAt >= fromMs && s.startedAt < toMs)
}

// ── Streak ────────────────────────────────────────────────────────────────

export function currentStreakDays(history: WorkoutSession[], now: number): number {
  if (history.length === 0) return 0
  const days = new Set(history.map((s) => isoDayKey(s.startedAt)))
  let cursor = startOfDay(now)
  // If user hasn't trained today, allow streak to continue from yesterday.
  if (!days.has(isoDayKey(cursor))) {
    cursor -= DAY_MS
    if (!days.has(isoDayKey(cursor))) return 0
  }
  let streak = 0
  while (days.has(isoDayKey(cursor))) {
    streak += 1
    cursor -= DAY_MS
  }
  return streak
}

// ── Heatmap source data ───────────────────────────────────────────────────

export function dayCounts(
  history: WorkoutSession[],
  fromMs: number,
  toMs: number,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of history) {
    if (s.startedAt < fromMs || s.startedAt >= toMs) continue
    const k = isoDayKey(s.startedAt)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

// ── Weekly buckets ────────────────────────────────────────────────────────

export interface WeekBucket {
  weekStart: number
  sessionCount: number
  volumeKg: number
}

export function weeklyVolumeSeries(
  history: WorkoutSession[],
  weeks: number,
  now: number,
): WeekBucket[] {
  const currentWeekStart = startOfWeek(now)
  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.push({
      weekStart: currentWeekStart - i * WEEK_MS,
      sessionCount: 0,
      volumeKg: 0,
    })
  }
  const firstStart = buckets[0].weekStart
  const lastEnd = buckets[buckets.length - 1].weekStart + WEEK_MS
  for (const s of history) {
    if (s.startedAt < firstStart || s.startedAt >= lastEnd) continue
    const idx = Math.floor((s.startedAt - firstStart) / WEEK_MS)
    if (idx < 0 || idx >= buckets.length) continue
    buckets[idx].sessionCount += 1
    buckets[idx].volumeKg += sessionVolumeKg(s)
  }
  return buckets
}

// ── Muscle balance ────────────────────────────────────────────────────────

// Split each set's kg-volume evenly across the exercise's primaryMuscles.
// Approximate but predictable — a Bench Press (primary=chest) puts all
// volume into chest; a compound with two primaries splits 50/50.
export function muscleVolume(
  history: WorkoutSession[],
  exerciseById: Map<string, Exercise>,
  fromMs: number,
  toMs: number,
): Map<Muscle, number> {
  const m = new Map<Muscle, number>()
  for (const s of history) {
    if (s.startedAt < fromMs || s.startedAt >= toMs) continue
    for (const ex of s.exercises) {
      const meta = exerciseById.get(ex.exerciseId)
      if (!meta || meta.primaryMuscles.length === 0) continue
      let exKg = 0
      for (const set of ex.sets) {
        if (set.completedAt && set.actualReps && set.actualWeight) {
          exKg += toKg(set.actualWeight, set.weightUnit) * set.actualReps
        }
      }
      if (exKg === 0) continue
      const share = exKg / meta.primaryMuscles.length
      for (const muscle of meta.primaryMuscles) {
        m.set(muscle, (m.get(muscle) ?? 0) + share)
      }
    }
  }
  return m
}

// ── Top exercises by frequency ────────────────────────────────────────────

export interface FrequencyEntry {
  exerciseId: string
  count: number
  lastDoneAt: number
}

export function topExercisesByFrequency(
  history: WorkoutSession[],
  fromMs: number,
  toMs: number,
  limit: number,
): FrequencyEntry[] {
  const m = new Map<string, FrequencyEntry>()
  for (const s of history) {
    if (s.startedAt < fromMs || s.startedAt >= toMs) continue
    const seenInSession = new Set<string>()
    for (const ex of s.exercises) {
      if (seenInSession.has(ex.exerciseId)) continue
      const completed = ex.sets.some((set) => set.completedAt)
      if (!completed) continue
      seenInSession.add(ex.exerciseId)
      const cur = m.get(ex.exerciseId) ?? {
        exerciseId: ex.exerciseId,
        count: 0,
        lastDoneAt: 0,
      }
      cur.count += 1
      cur.lastDoneAt = Math.max(cur.lastDoneAt, s.startedAt)
      m.set(ex.exerciseId, cur)
    }
  }
  return Array.from(m.values())
    .sort((a, b) => b.count - a.count || b.lastDoneAt - a.lastDoneAt)
    .slice(0, limit)
}

// ── Recent distinct-exercise PRs ──────────────────────────────────────────

export interface PREntry {
  exerciseId: string
  bestKg: number  // 0 = pure bodyweight (no weight tracked)
  bestReps: number
  prSessionStartedAt: number
}

export function recentDistinctPRs(history: WorkoutSession[], limit: number): PREntry[] {
  const seen = new Set<string>()
  const all: PREntry[] = []
  for (const session of history) {
    for (const ex of session.exercises) {
      if (seen.has(ex.exerciseId)) continue
      seen.add(ex.exerciseId)
      let bestScore = 0
      let bestKg = 0
      let bestReps = 0
      let prSessionStartedAt = 0
      for (const otherSession of history) {
        const otherEx = otherSession.exercises.find((e) => e.exerciseId === ex.exerciseId)
        if (!otherEx) continue
        for (const set of otherEx.sets) {
          if (!set.completedAt) continue
          const reps = set.actualReps ?? 0
          if (reps === 0) continue
          const weightKg = set.actualWeight ? toKg(set.actualWeight, set.weightUnit) : 1
          const score = weightKg * reps
          if (score > bestScore) {
            bestScore = score
            bestKg = set.actualWeight ? weightKg : 0
            bestReps = reps
            prSessionStartedAt = otherSession.startedAt
          }
        }
      }
      if (bestScore > 0) {
        all.push({ exerciseId: ex.exerciseId, bestKg, bestReps, prSessionStartedAt })
      }
    }
  }
  return all
    .sort((a, b) => b.prSessionStartedAt - a.prSessionStartedAt)
    .slice(0, limit)
}
