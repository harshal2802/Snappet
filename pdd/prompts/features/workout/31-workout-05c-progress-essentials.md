# Prompt: Workout app — Phase 5c: Progress in ExerciseDetail + Essentials view

**File**: pdd/prompts/features/workout/31-workout-05c-progress-essentials.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Chain**: 5c of 5 — final feedback PR
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Issue**: #38
**Depends on**: Phase 5a (PR #39), Phase 5b (PR #40)

## Context

Two remaining feedback items from #38:

- **#2 (rest) — catalog overload**. The full 800-exercise catalog is overwhelming when building a routine. Phase 5a already gave users the in-routine rename. This PR adds a curated **Essentials** list (~100 IDs) that's the *default* view in the Browser. A toggle reveals all 800 for power users.
- **#5 — per-exercise progress dashboard**. `ExerciseProgress` already exists but is buried inside `SessionDetail`. This PR promotes it to `ExerciseDetail` (the view a user gets when they tap any exercise in the Browser) and wraps it in three stat cards (top set, total volume, session count) with a ★ PR marker on the all-time-best bar.

No new dependencies. No new schema. The chart is the same SVG we ship today.

**Stack**: React 18, TypeScript (strict), Tailwind CSS.

## Architecture

```
src/frontend/apps/workout/

  essentials.ts                                      (new)
  └── export const ESSENTIAL_EXERCISE_IDS: string[]   ~100 IDs, every one
                                                     verified to exist in
                                                     exercises.json

  ExerciseBrowser.tsx                                (edit)
  ├── new state: essentialsOnly via useLocalStorage('snappet:workout:essentials-only', true)
  ├── new derived: filteredByEssentials before the existing filter chain
  └── new UI: Essentials/All segmented toggle in the sticky controls row

  ExerciseDetail.tsx                                 (edit)
  ├── accept new `history` prop (optional — when omitted, Progress section hidden)
  ├── render <ExerciseProgressPanel /> above the "How to do it" section
  │   only when history contains ≥1 completed-set entry for this exercise
  └── ExerciseProgressPanel sub-component (defined in same file for proximity)
       — 3 stat cards: top set, total volume (kg), session count
       — wraps existing <ExerciseProgress /> chart
       — passes a `prSessionStartedAt` to <ExerciseProgress /> for the ★ marker

  ExerciseProgress.tsx                               (edit)
  ├── accept optional `prSessionStartedAt?: number` prop
  └── if provided, render a ★ icon above the bar whose `date` matches

  index.tsx                                          (edit)
  └── pass `history` down: index.tsx → ExerciseBrowser → ExerciseDetail
       (Browser already mounts Detail; just thread history through)
```

## Output format

### 1. `src/frontend/apps/workout/essentials.ts` (new)

Hand-curated list of ~100 exercise IDs covering all major muscle × equipment combinations. Every ID was verified to exist in `public/exercises.json` (verification script run before commit). Comments group by body area for readability and future maintenance.

Single export:

```ts
export const ESSENTIAL_EXERCISE_IDS: ReadonlyArray<string> = [
  // Chest …
  // Back / Pull …
  // Shoulders …
  // …etc.
] as const

export const ESSENTIAL_ID_SET = new Set<string>(ESSENTIAL_EXERCISE_IDS)
```

The `Set` is exported so the Browser's per-exercise lookup is `O(1)`.

### 2. `src/frontend/apps/workout/ExerciseBrowser.tsx` (edit)

Add a persisted toggle, default `true`:

```ts
const [essentialsOnly, setEssentialsOnly] = useLocalStorage<boolean>(
  'snappet:workout:essentials-only',
  true,
)
```

Insert before the existing filter chain. Use `ESSENTIAL_ID_SET` to avoid a per-render `.includes` over 100 IDs:

```ts
const filtered = useMemo(() => {
  if (!exercises) return []
  return exercises.filter((ex) => {
    if (essentialsOnly && !ESSENTIAL_ID_SET.has(ex.id)) return false
    if (!matchesQuery(bagsById.get(ex.id) ?? [], searchTerm)) return false
    return matchesFilters(ex, filters)
  })
}, [exercises, searchTerm, filters, bagsById, essentialsOnly])
```

UI — the sticky controls row already has a search input + Filters button + result count. Add a small segmented toggle (Essentials | All) on the row above the count, full-width on mobile:

```
┌─────────────────────────────────────────────┐
│ [🔍 Search exercises…]      [Filters (2)]   │
│ ┌──────────┬──────────────────┐             │
│ │Essentials│ All exercises    │             │
│ └──────────┴──────────────────┘             │
│ 23 exercises                                 │
└─────────────────────────────────────────────┘
```

Same `<button aria-pressed>` segmented-control pattern used in `RoutineEditor`'s kg/lb toggle. The active label is bold; the inactive is muted. Whole row sits flush below the search/filters row.

### 3. `src/frontend/apps/workout/index.tsx` (edit)

Thread `history` into `ExerciseBrowser`:

```tsx
{tab === 'browse' && (
  <ExerciseBrowser
    resetSignal={browseResetCounter}
    history={history}
  />
)}
```

Add `history` to `ExerciseBrowserProps`:

```ts
interface ExerciseBrowserProps {
  resetSignal: number
  history: WorkoutSession[]   // NEW — passed through to ExerciseDetail
}
```

Browser passes it on to both `ExerciseDetail` mounts (desktop side-pane and mobile modal).

### 4. `src/frontend/apps/workout/ExerciseDetail.tsx` (edit)

Add the prop:

```ts
interface ExerciseDetailProps {
  exercise: Exercise
  onClose: () => void
  inline?: boolean
  history?: WorkoutSession[]   // NEW — optional; Progress section only renders when present
}
```

Place the new section between the metadata pills and the muscles section (so progress is visible "above the fold" once a user has any history). Skip when `history` is missing or empty for this exercise.

New sub-component, defined in the same file:

```tsx
interface ExerciseProgressPanelProps {
  exerciseId: string
  history: WorkoutSession[]
}

function ExerciseProgressPanel({ exerciseId, history }: ExerciseProgressPanelProps) {
  // Aggregate stats from history.
  // - topSet (any unit converted to kg)
  // - totalVolumeKg (sum across all sessions)
  // - sessionCount (sessions where the exercise has ≥1 completed set)
  // - prSessionStartedAt (timestamp of the session with the best top set)

  // Return null if sessionCount === 0.

  // Layout: three stat cards in a 3-col grid, then <ExerciseProgress />.
}
```

Aggregation rules — same `toKg(weight, unit)` shape we use elsewhere; reuse the helper from `SessionDetail` (extract a tiny `progress.ts` if both files would otherwise duplicate logic — see step 6).

### 5. `src/frontend/apps/workout/ExerciseProgress.tsx` (edit)

Add an optional `prSessionStartedAt?: number` prop. When the date of a point matches the PR session, render a small ★ above its bar, anchored at `x = barCenter`, `y = barTop − 6`. SVG `<text>` with class `fill-amber-500`. Keep the chart's bar heights / axis labels otherwise unchanged.

### 6. `src/frontend/apps/workout/progress.ts` (new, optional)

If the same weight/volume aggregation now lives in `SessionDetail` and `ExerciseProgressPanel`, extract three pure functions:

```ts
export function toKg(weight: number, unit: WeightUnit | undefined): number
export function topSetForExercise(history: WorkoutSession[], exerciseId: string): {
  bestKg: number
  prSessionStartedAt: number
} | null
export function totalVolumeForExercise(history: WorkoutSession[], exerciseId: string): number
export function sessionCountForExercise(history: WorkoutSession[], exerciseId: string): number
```

Both call sites import from here. If the duplication is small enough to ignore, skip this file — judgement call.

### 7. PWA precache

`essentials.ts` is bundled via the JS chunk, not the JSON precache. No `vite-plugin-pwa` config changes needed; the new file just rides along in the main entry bundle. Confirm via `vite build` log — precache manifest entry count and size should be unchanged.

## Quality criteria

- **Verified IDs**: every entry in `ESSENTIAL_EXERCISE_IDS` exists in `public/exercises.json`. Include a one-shot verifier in the commit message (or as a comment in `essentials.ts`).
- **Backwards-compatible**: existing routines / sessions / preferences unaffected.
- **First-run UX**: `essentialsOnly` defaults to `true`, so a user opening the Browser sees ~100 cards instead of 800. Toggle to "All" to escape — preference persists.
- **Empty state**: when the user is on Essentials and their query/filter produces 0 hits, surface a one-line hint: "No matches in Essentials. Try All exercises." with a button that flips the toggle. Keep the existing "Try clearing filters" empty state when on All.
- **Progress section is opt-in by data**: if no completed session for that exercise, render nothing — no empty stat cards, no "0 sessions" header.
- **`tsc --noEmit` and `vite build` clean**.

## Don't change

- The `exercises.json` data file (already complete).
- The `WorkoutSession` / `SessionExercise` shapes (Phase 5a already added `displayName`).
- The `Routine.defaults` schema (Phase 5b).
- Anything in `WorkoutPlayer`, `RoutineEditor`, `SettingsView`, `RoutineList`, `HistoryView`.

## Acceptance (mirrors issue #38)

- [ ] Browser opens in Essentials mode on first run (after this PR ships)
- [ ] Toggling "All exercises" reveals all 800; preference persists
- [ ] Essentials list has ~100 entries; every ID resolves to a real exercise (no orphan cards)
- [ ] In `ExerciseDetail`, when the user has ≥1 completed session for the exercise, a Progress section appears with three stat cards: top set, total volume (kg), session count
- [ ] The bar chart marks the PR session with a ★
- [ ] Detail still renders cleanly for exercises the user has never done (no Progress section)
- [ ] `tsc --noEmit` clean; `vite build` clean

## Next step

Phase 5 chain complete. Possible follow-ups (each its own future PR): clear-all-history destructive action, body weight tracking, cardio-specific session shape, JSON import to restore from export. The PLAN file's "Next step" list already enumerates these.
