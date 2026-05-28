# Prompt: Workout app — Phase 4: History + Progress

**File**: pdd/prompts/features/workout/28-workout-04-history.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Chain**: 4 of 4 — final phase
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Depends on**:
- Phase 1 (PR #30): catalog data, exerciseById
- Phase 2 (PR #31): RoutineList, tab pattern
- Phase 3 (PR #32): `WorkoutSession` type, `snappet:workout:history` localStorage key

## Context

Phase 3 lands completed sessions in `snappet:workout:history`. Phase 4 makes that data visible: a chronological list, a drill-down per session showing what was actually done set-by-set, and a tiny progress chart per exercise. Plus a JSON export so users can take their data with them. No new state shapes — pure read-and-render plus a download.

**Stack**: React 18, TypeScript (strict), Tailwind CSS. No new deps. Inline SVG for the progress chart (no chart library — Snappet's pattern is to avoid them).

**Existing from Phase 3**:
- `src/frontend/apps/workout/types.ts` — `WorkoutSession`, `SessionExercise`, `SetLog`, `WeightUnit`
- `src/frontend/apps/workout/index.tsx` — orchestrator with **Browse | Routines** tabs (this phase adds a third tab)
- `src/frontend/apps/workout/ExerciseImage.tsx` — for per-exercise thumbnails
- `snappet:workout:history` — `WorkoutSession[]` (most recent prepended per Phase 3's `setHistory((h) => [final, ...h])`)

## Architecture

```
index.tsx (extend)
├── persisted: history (already exists from Phase 3 wiring)
├── add Tab type: 'browse' | 'routines' | 'history'
└── route Tab === 'history' → <HistoryView />

HistoryView.tsx (new)
├── if history is empty: friendly empty state
├── otherwise: top bar with Export button + list of sessions
└── tapping a session → <SessionDetail /> (inline below list on desktop ≥ md,
                                            full-screen modal on mobile, similar to ExerciseDetail pattern)

SessionDetail.tsx (new)
├── header: routine name, ISO date, duration, total volume
├── per-exercise blocks: name + thumb, set-by-set table (target → actual),
│   skipped badge, and an <ExerciseProgress /> chart when there are 2+ entries
└── close (✕) returns to list

ExerciseProgress.tsx (new)
├── props: exerciseId, history (or already-filtered prior sessions)
└── inline SVG bar chart, last-10 sessions including the current one
```

## Output format

### 1. `src/frontend/apps/workout/index.tsx` (extend)

Change the Tab type and add the third tab button:

```ts
type Tab = 'browse' | 'routines' | 'history'
```

Tab button row stays a 3-cell segmented control:
- Browse
- Routines (N)
- History (N) — same `(count)` pattern, where count is `history.length`

Body branching: add a third branch `{tab === 'history' && <HistoryView history={history} setHistory={setHistory} exerciseById={exerciseById} />}`. The orchestrator already owns `history` and `setHistory` (from Phase 3) — Phase 4 wires them through.

Reset visibility stays as it is — Reset button only shown on Browse tab.

### 2. `src/frontend/apps/workout/HistoryView.tsx` (new)

Props:
```ts
interface HistoryViewProps {
  history: WorkoutSession[]
  setHistory: React.Dispatch<React.SetStateAction<WorkoutSession[]>>
  exerciseById: Map<string, Exercise>
}
```

Layout (`space-y-3`):

**Header row** — count on the left + actions on the right:
- "N completed workout{N === 1 ? '' : 's'}"
- **Export JSON** button — small, secondary
- (No "Clear all" — leave that to a future destructive-action PR; users can clear from devtools if they really want)

**Empty state** (when `history.length === 0`):
- Friendly icon + "No completed workouts yet. Start a routine to see it here."

**Session list** — most recent first (the history is already prepended in that order; just render as-is):

Each card:
- Top row: routine name (large) + ISO date (short — e.g. "Mar 15") on the right
- Meta line: duration (`formatDuration(completedAt - startedAt)`) · X/Y sets · ≈ Z kg volume
- Below: first 3 exercise thumbnails inline (similar to RoutineList)
- Tap anywhere → opens `<SessionDetail />`

Selected session detail:
- Desktop (`md+`): inline below the tapped card (or a side panel — pick whichever fits the existing pattern in this app). Use the **same inline/modal pattern as ExerciseBrowser/ExerciseDetail** to keep behavior consistent: a 2-column grid on `md+` with list left + detail right, modal-style on mobile.
- Mobile (`< md`): `<SessionDetail />` renders as full-screen overlay (same as ExerciseDetail's modal mode)

#### Export JSON

```ts
function handleExport() {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessions: history,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `snappet-workout-history-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
```

### 3. `src/frontend/apps/workout/SessionDetail.tsx` (new)

Props:
```ts
interface SessionDetailProps {
  session: WorkoutSession
  history: WorkoutSession[]          // for the per-exercise progress chart
  exerciseById: Map<string, Exercise>
  onClose: () => void
  /** When true (desktop), renders inline (no backdrop). Mirrors ExerciseDetail. */
  inline?: boolean
}
```

Body:
- Sticky header (when modal): routine name + ✕ close
- Stats row: 4 small cards (Date, Duration, Sets X/Y, Volume kg) — same look as DoneScreen but smaller; mobile-friendly 2×2 grid
- For each `SessionExercise`:
  - Card with exercise thumbnail + name on top
  - Targets row: "{targetSets} × {targetReps}{weight ? ` @ ${weight}${unit}` : ''}, ${rest}s rest"
  - **Skipped** pill if `session.exercises[i].skipped`
  - Set table (no header bar, just rows): `Set N — {reps} reps × {weight}{unit}` or "Set N — Skipped" if `!completedAt`. Use tabular-nums for alignment.
  - `<ExerciseProgress exerciseId={ex.exerciseId} history={history} exerciseById={exerciseById} />` BELOW the sets if at least 2 sessions in `history` include this exerciseId (i.e. there's something to chart)
- Close on ✕, Escape, and backdrop tap (mobile)

### 4. `src/frontend/apps/workout/ExerciseProgress.tsx` (new)

Props:
```ts
interface ExerciseProgressProps {
  exerciseId: string
  history: WorkoutSession[]
  /** Optional cap — defaults to 10 most recent sessions including this exercise. */
  limit?: number
}
```

Algorithm:
1. Filter `history` to sessions whose `exercises` contains `exerciseId` and where at least one set was completed
2. For each, compute the **top set's volume** = `max(set.actualWeight * set.actualReps)` across completed sets of that exercise. For sets without a weight, treat weight as 1 (so reps alone still produce a chart). Strip trailing 0s
3. Take the most recent `limit` (default 10) — note `history` is most-recent-first, so `slice(0, limit)`
4. Reverse for chronological left-to-right display

Render an inline SVG bar chart:
- Container width 100%, height ~120 px
- Bars equally spaced; bar width auto from chart width / N
- Each bar: hover/tap shows a tooltip with the date + value
- Bottom axis: 3 tick labels max (first, middle, last date) to avoid crowding
- Empty state (filtered to 0 or 1 sessions): render nothing (caller already guards on `≥ 2`)

Color: blue-500 / blue-400 in dark mode (matches the app's accent).

The chart should be **purely SVG + math** — no animation lib, no chart lib. ~80–120 LoC including helpers.

### 5. Tab pip / count behavior

When the user starts and completes a session in this same browser tab, `history` updates and the History tab pip should reflect the new count immediately. Since `useLocalStorage` is the source of truth at the orchestrator and we're already re-rendering on `history` change, this works for free — just wire the count in the tab label.

## Acceptance criteria

- [ ] **History tab** appears in the tab control next to Browse and Routines, with a `(N)` count
- [ ] Empty state when no history; **Export JSON** button hidden in that case
- [ ] After completing one or more workouts (from Phase 3), they appear in the History tab, most-recent first
- [ ] Each session card shows routine name, short date, duration, sets count, volume
- [ ] Tapping a session opens the detail (modal on mobile, inline side-pane on desktop ≥ md)
- [ ] Detail shows session stats + per-exercise sets (target + actual side-by-side); skipped exercises show a "Skipped" pill
- [ ] **ExerciseProgress chart** appears under exercises that have 2+ historical entries, showing top-set volume per session as inline SVG bars
- [ ] Sessions with no weight (bodyweight) still produce a chart based on reps only (weight defaulted to 1 in the volume calc)
- [ ] **Export JSON** downloads a file named `snappet-workout-history-YYYY-MM-DD.json` containing `{ exportedAt, sessions: [...] }`
- [ ] Closing the detail (✕, Escape, mobile backdrop) returns to the list with state intact
- [ ] Tab persists across reload (existing behavior)
- [ ] Mobile (375 px): list scrolls; detail is full-screen modal with sticky header; chart is responsive width
- [ ] Dark mode on all new UI
- [ ] `tsc --noEmit` clean; `npm run build` succeeds; precache shouldn't grow more than ~5–10 KiB

## Constraints

- **No new dependencies.** Inline SVG only for the chart — Snappet's pattern.
- TypeScript strict; no `any`.
- All Tailwind class lookups for accent colors are static literals so the content scanner picks them up.
- The detail's inline/modal pattern should mirror `ExerciseDetail.tsx` (same `inline?: boolean` prop, same Escape/backdrop close pattern).
- The progress chart treats missing weights as 1 so bodyweight exercises produce a meaningful chart. Document this in a brief code comment.
- **No destructive actions.** Don't ship a "Clear all history" button in this PR — leave that to a separate one. Users wanting to clear can use devtools → Application → Local Storage → delete the key.
- This is the final phase. Update `PLAN-workout-app.md` to mark Phase 4 as shipped (small docs edit at the end).

## Test plan

1. `npm run dev`; complete 2–3 short workouts from Phase 3 (use the Mobility starter — quick to finish)
2. Open History tab → see 2–3 sessions newest-first
3. Tap a session → detail opens with stats + per-exercise sets
4. For an exercise appearing in 2+ sessions, the chart renders below its set table
5. Mobile emulation: detail is full-screen modal; chart is full-width
6. Export JSON → downloaded file opens with `{ exportedAt, sessions: [...] }`
7. Reload → history persists, tab persists, no regressions to Browse/Routines/Player
8. Edge case: a session with all sets skipped or zero-volume — chart math doesn't NaN/Infinity (defensive); UI still renders the session card
9. `tsc --noEmit` clean; `npm run build` succeeds
