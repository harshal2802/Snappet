# Prompt: Workout app — Phase 6: Dashboard tab

**File**: pdd/prompts/features/workout/32-workout-06-dashboard.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Chain**: 6 of 6 (first net-new feature post-feedback chain)
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Research**: `pdd/context/research/workout-dashboard.md`
**Depends on**: Phases 1–5 (shipped) — uses existing types, helpers, and Exercise data shape.

## Context

Workout app today has Browse / Routines / History / Settings tabs. None of them surface cross-cutting answers: am I consistent, is volume trending, which muscle groups am I neglecting, when was my last PR. This phase adds a **Dashboard** as the new first tab with six sections, all inline SVG, no new dependencies, read-only over `snappet:workout:history`.

**Stack**: React 18, TypeScript (strict), Tailwind CSS. No new dependencies.

## Architecture

```
src/frontend/apps/workout/

  dashboard.ts                                   (new)
  ├── date helpers
  │   ├── startOfDay(ms)                    midnight in local tz
  │   ├── startOfWeek(ms)                   Monday 00:00 local
  │   ├── isoDayKey(ms)                     "YYYY-MM-DD" local
  │   └── isoWeekKey(ms)                    same — just startOfWeek's key
  ├── aggregators
  │   ├── sessionsInRange(history, fromMs, toMs)
  │   ├── volumeKg(session)                 reused convenience
  │   ├── currentStreakDays(history, now)   consecutive days w/ ≥1 session
  │   ├── dayCounts(history, fromMs, toMs)  Map<isoDayKey, count>
  │   ├── weeklyVolumeSeries(history, weeks, now)
  │   │       returns 12-entry array of {weekStart, volumeKg, sessionCount}
  │   ├── muscleVolume(history, exerciseById, fromMs, toMs)
  │   │       returns Map<Muscle, kg> (primaryMuscles only;
  │   │       split weight evenly across primary muscles per set)
  │   ├── topExercisesByFrequency(history, fromMs, toMs, limit=5)
  │   │       returns Array<{exerciseId, count, lastDoneAt}>
  │   └── recentDistinctPRs(history, limit=5)
  │           returns Array<{exerciseId, bestKg, bestReps, prSessionStartedAt}>
  │           — at most one entry per exercise; ranked by prSessionStartedAt desc
  └── window helpers
      ├── thisWeekRange(now)                {fromMs, toMs} for Mon–Sun this week
      ├── lastWeekRange(now)                Mon–Sun previous week
      └── last30Days(now)                   {fromMs, toMs}

  Dashboard.tsx                                  (new — orchestrator)
  ├── props: { history, exerciseById, exercises, onOpenExercise(id) }
  ├── if history.length === 0 → <EmptyDashboard />
  └── otherwise vertical stack of 6 widgets

  dashboard/                                     (new folder for widgets)
    WeekSnapshot.tsx
    ConsistencyHeatmap.tsx
    VolumeSparkline.tsx
    MuscleBalance.tsx
    RecentPRs.tsx
    TopExercises.tsx

  index.tsx                                      (edit)
  ├── Tab = 'dashboard' | 'browse' | 'routines' | 'history' | 'settings'
  ├── default value: 'dashboard' (existing users keep saved tab)
  ├── new top tab button "Dashboard"
  └── render <Dashboard /> when tab === 'dashboard'; pass onOpenExercise
      that flips tab to 'browse' + selects the exercise id
```

## Output format

### 1. `src/frontend/apps/workout/dashboard.ts` (new)

Pure module. No React imports. Reuses `toKg` from `progress.ts`.

```ts
import { toKg } from './progress'
import type { Exercise, Muscle, WorkoutSession } from './types'

// ── Date helpers (local tz) ────────────────────────────────────────────────

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms))
  // ISO week: Monday = 1, Sunday = 0 in JS getDay()
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

// ── Range helpers ──────────────────────────────────────────────────────────

export function thisWeekRange(now: number): { fromMs: number; toMs: number } {
  const fromMs = startOfWeek(now)
  return { fromMs, toMs: fromMs + 7 * 24 * 60 * 60 * 1000 }
}

export function lastWeekRange(now: number): { fromMs: number; toMs: number } {
  const fromMs = startOfWeek(now) - 7 * 24 * 60 * 60 * 1000
  return { fromMs, toMs: fromMs + 7 * 24 * 60 * 60 * 1000 }
}

export function last30Days(now: number): { fromMs: number; toMs: number } {
  return { fromMs: startOfDay(now - 30 * 24 * 60 * 60 * 1000), toMs: now }
}

// ── Aggregators ────────────────────────────────────────────────────────────

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

export function currentStreakDays(history: WorkoutSession[], now: number): number {
  if (history.length === 0) return 0
  const days = new Set(history.map((s) => isoDayKey(s.startedAt)))
  let streak = 0
  let cursor = startOfDay(now)
  // If user hasn't trained today, allow streak to continue if they trained yesterday
  if (!days.has(isoDayKey(cursor))) {
    cursor -= 24 * 60 * 60 * 1000
    if (!days.has(isoDayKey(cursor))) return 0
  }
  while (days.has(isoDayKey(cursor))) {
    streak += 1
    cursor -= 24 * 60 * 60 * 1000
  }
  return streak
}

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
    const weekStart = currentWeekStart - i * 7 * 24 * 60 * 60 * 1000
    buckets.push({ weekStart, sessionCount: 0, volumeKg: 0 })
  }
  const firstStart = buckets[0].weekStart
  const lastEnd = buckets[buckets.length - 1].weekStart + 7 * 24 * 60 * 60 * 1000
  for (const s of history) {
    if (s.startedAt < firstStart || s.startedAt >= lastEnd) continue
    const idx = Math.floor((s.startedAt - firstStart) / (7 * 24 * 60 * 60 * 1000))
    if (idx < 0 || idx >= buckets.length) continue
    buckets[idx].sessionCount += 1
    buckets[idx].volumeKg += sessionVolumeKg(s)
  }
  return buckets
}

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
      // Sum this exercise's contributed kg across the session
      let exKg = 0
      for (const set of ex.sets) {
        if (set.completedAt && set.actualReps && set.actualWeight) {
          exKg += toKg(set.actualWeight, set.weightUnit) * set.actualReps
        }
      }
      if (exKg === 0) continue
      // Split evenly across primary muscles
      const share = exKg / meta.primaryMuscles.length
      for (const muscle of meta.primaryMuscles) {
        m.set(muscle, (m.get(muscle) ?? 0) + share)
      }
    }
  }
  return m
}

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

export interface PREntry {
  exerciseId: string
  bestKg: number
  bestReps: number
  prSessionStartedAt: number
}

export function recentDistinctPRs(history: WorkoutSession[], limit: number): PREntry[] {
  // Walk every exercise we've ever done; reuse topSetForExercise's logic inline.
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
```

Note on muscle splitting: a Bench Press with `primaryMuscles: ['chest']` gives all volume to chest; a compound with two primaries splits 50/50. This is approximate but simple, predictable, and uses data we already have.

### 2. `src/frontend/apps/workout/Dashboard.tsx` (new)

Orchestrator. Reads `now = Date.now()` once at render, computes nothing itself, delegates to widgets.

```tsx
import { useMemo } from 'react'
import type { Exercise, WorkoutSession } from './types'
import WeekSnapshot from './dashboard/WeekSnapshot'
import ConsistencyHeatmap from './dashboard/ConsistencyHeatmap'
import VolumeSparkline from './dashboard/VolumeSparkline'
import MuscleBalance from './dashboard/MuscleBalance'
import RecentPRs from './dashboard/RecentPRs'
import TopExercises from './dashboard/TopExercises'

interface DashboardProps {
  history: WorkoutSession[]
  exerciseById: Map<string, Exercise>
  onOpenExercise: (exerciseId: string) => void
  onGoToRoutines: () => void
}

export default function Dashboard({
  history,
  exerciseById,
  onOpenExercise,
  onGoToRoutines,
}: DashboardProps) {
  const now = useMemo(() => Date.now(), [history])

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
      <WeekSnapshot history={history} now={now} />
      <ConsistencyHeatmap history={history} now={now} />
      <VolumeSparkline history={history} now={now} />
      <MuscleBalance history={history} exerciseById={exerciseById} now={now} />
      <RecentPRs history={history} exerciseById={exerciseById} onOpen={onOpenExercise} />
      <TopExercises history={history} exerciseById={exerciseById} now={now} />
    </div>
  )
}
```

### 3. Widget components

Each widget owns:
- A small section header (`text-xs font-semibold uppercase tracking-wide text-gray-500`)
- The visualization in a card (`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4`)
- Inline SVG for charts; no external deps

#### `dashboard/WeekSnapshot.tsx`

Three tiles side-by-side on `sm+`, stacked on mobile:

- **Sessions** — this-week count, delta vs last week (↑/↓ + abs value)
- **Volume (kg)** — this-week total, delta vs last week
- **Streak** — current consecutive-day streak with a 🔥 icon if > 0

Implementation uses `sessionsInRange(history, thisWeekRange().fromMs, thisWeekRange().toMs)` and the symmetric `lastWeekRange`. Deltas are absolute; tiles render no delta when no prior data.

#### `dashboard/ConsistencyHeatmap.tsx`

7 rows (Mon–Sun) × 12 columns (last 12 ISO weeks). Each cell is a small SVG `<rect>` with a fill from a 4-step scale (gray-200 / blue-200 / blue-400 / blue-600 light; gray-700 / blue-900 / blue-700 / blue-500 dark) keyed on `dayCounts(history, ...)` for that day:

- 0 sessions → empty
- 1 → light
- 2 → medium
- 3+ → dark

Below the grid: a tiny legend ("Less ░ ▒ ▓ █ More") + month label ticks at the appropriate column positions.

Cell size: 14 × 14 px (responsive). Gap: 2 px.

#### `dashboard/VolumeSparkline.tsx`

Single inline-SVG polyline over `weeklyVolumeSeries(history, 12, now)`. Y-normalised to max in window. Dot on the current (right-most) week with the volume value labeled above it (e.g. "4,820 kg").

If a week has 0 volume, no point is rendered (gaps in the line are OK).

Axis: bottom row of month labels at 3 anchor weeks (first, middle, last) — same pattern as `ExerciseProgress`.

#### `dashboard/MuscleBalance.tsx`

Horizontal bars, top 6 muscles from `muscleVolume(history, exerciseById, last30Days().fromMs, last30Days().toMs)` sorted desc:

```
chest      ████████████  3,200 kg
back       █████████     2,400 kg
...
```

Bar width: percentage of the top muscle's kg. Label on the left (capitalized first letter), bar fills the middle, kg label right-aligned. ~16 px row height.

If the user has < 1 muscle with non-zero volume, render a small "Not enough weighted volume in the last 30 days" line. (Pure-bodyweight users skip this section gracefully.)

#### `dashboard/RecentPRs.tsx`

`recentDistinctPRs(history, 5)` →

```
★ Bench Press        100 kg × 5   May 22 →
★ Barbell Squat      120 kg × 5   May 19 →
...
```

Each row is a button — tapping calls `onOpen(exerciseId)`, which (per `index.tsx` wiring) jumps to Browse and opens that exercise (Phase 5c's Progress panel will be visible there).

Display name resolves via `getDisplayName(undefined, exerciseById.get(id))` (no displayName on PR rows — they're catalog-level aggregates).

#### `dashboard/TopExercises.tsx`

`topExercisesByFrequency(history, last30Days().fromMs, last30Days().toMs, 5)`:

```
Bench Press        8 sessions    last: May 22
Barbell Squat      7 sessions    last: May 19
...
```

No tap-through (frequency is informational).

### 4. `src/frontend/apps/workout/index.tsx` (edit)

```ts
type Tab = 'dashboard' | 'browse' | 'routines' | 'history' | 'settings'

// useLocalStorage already gracefully handles default-on-missing; bump the default.
const [tab, setTab] = useLocalStorage<Tab>('snappet:workout:tab', 'dashboard')
```

Existing users with a stored tab keep what they had (useLocalStorage only uses the default when the key is absent).

Add a "Dashboard" tab button as the leftmost in the tab strip. Pass needed props:

```tsx
{tab === 'dashboard' && (
  <Dashboard
    history={history}
    exerciseById={exerciseById}
    onOpenExercise={(id) => {
      // Cross-tab navigation: flip to Browse and prime the selection.
      // ExerciseBrowser doesn't yet accept an external "select this id"
      // prop, so we surface a small `pendingExerciseId` state from
      // index.tsx and ExerciseBrowser reads it on mount (one-shot consume).
      setPendingExerciseId(id)
      setTab('browse')
    }}
    onGoToRoutines={() => setTab('routines')}
  />
)}
```

Add `pendingExerciseId` state in `index.tsx`. Update `ExerciseBrowser`'s props to accept it + a "consume" callback:

```ts
interface ExerciseBrowserProps {
  resetSignal: number
  history: WorkoutSession[]
  pendingExerciseId?: string | null
  onConsumePending?: () => void
}
```

Inside `ExerciseBrowser`, a `useEffect([pendingExerciseId, exercises])` checks for a non-null `pendingExerciseId` once exercises are loaded; if present, sets `selectedId` to it and calls `onConsumePending()` to clear the buffer. Robust to refresh: the pending id lives only in in-memory state, not localStorage.

Reset button stays on Browse-only — Dashboard doesn't need a Reset.

### 5. Tab strip layout — fits 5 tabs

With 5 tabs (Dashboard, Browse, Routines, History, Settings) on mobile (~360 px), the existing `flex gap-1 p-1 ... rounded-xl w-full sm:w-fit` shrinks each tab. Verify the labels still fit. If too tight, drop the `(N)` counter from the Settings tab (it has no counter today) and consider shortening "Dashboard" — actually keep "Dashboard" full. Mobile test pass is the gate.

## Quality criteria

- **No new deps**.
- **Pure helpers** in `dashboard.ts` — no React imports, no side effects, testable.
- **Backwards-compatible storage** — no schema changes. Existing `snappet:workout:history` blob renders correctly.
- **Type-strict** — no `any`, all helpers fully typed.
- **Mobile-first** — vertical stack works at 360 px width; cards have padding; bars and heatmap cells respect ≥ 14 px hit area where interactive.
- **Empty state** rendered when `history.length === 0` — friendly nudge to Routines.
- **Cross-tab navigation** for PR feed → ExerciseDetail works without page reload and survives if you visit Browse via the tab bar in between (buffer is one-shot).

## Don't change

- The starter routines list, search, sticky unit, rename, routine defaults, Essentials list, or any other Phase 5 surface.
- The `progress.ts` helpers — reuse `toKg`, etc., as-is.
- localStorage key names other than (potentially) the default value for `snappet:workout:tab`.

## Acceptance

- [ ] `tsc --noEmit` clean; `vite build` clean
- [ ] New "Dashboard" tab appears as the leftmost tab on mobile + desktop
- [ ] Fresh install (no `snappet:workout:tab` in localStorage) lands on Dashboard
- [ ] Existing users keep their stored tab
- [ ] With empty history, Dashboard shows the friendly empty state with "Go to Routines" button
- [ ] With ≥1 session, all 6 widgets render correctly:
  - WeekSnapshot — three tiles, deltas vs last week, streak with 🔥 if >0
  - ConsistencyHeatmap — 7×12 grid, 4-step shading, month labels
  - VolumeSparkline — polyline over 12 weeks, dot + value on current week
  - MuscleBalance — top 6 horizontal bars from last 30 days
  - RecentPRs — up to 5 PR rows, tapping a row opens that exercise in Browse
  - TopExercises — top 5 by frequency in last 30 days
- [ ] Bodyweight-only user (no weighted volume) sees MuscleBalance render its graceful "not enough weighted volume" line, other widgets unaffected
- [ ] Streak handles "user trained today" and "user trained yesterday but not today" correctly
- [ ] No new console errors

## Next step

User-deploy review, then merge to main. Future Phase 7 candidates documented in PLAN's "Next step" list.
