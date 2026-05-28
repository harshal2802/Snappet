# Prompt: Workout app — Phase 5b: Routine defaults + apply-to-all

**File**: pdd/prompts/features/workout/30-workout-05b-routine-defaults.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Chain**: 5b of 5 — second of three feedback PRs
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Issue**: #38
**Depends on**: Phase 5a (PR #39) — clean baseline; not strictly required, but stacked for review ergonomics.

## Context

Feedback item #3 (issue #38): the user changes rest time on one exercise and the other rows aren't updated — they have to edit each row by hand. We're fixing that with two complementary affordances:

1. **Routine-level defaults** — a `defaults` block at the top of the editor with `sets / reps / restSeconds / weightUnit`. New picks from the catalog inherit these. Backwards-compatible: existing routines persist without `defaults` and behave exactly as before.
2. **Per-row ⇪ apply-to-all** — a small icon next to each row's sets / reps / rest field that pushes that row's value to every other row in the routine.

Plus an auto-derive migration: when a routine that doesn't yet have `defaults` is opened in the editor, compute a sensible starting point from its existing rows (median sets, mode reps, median rest, mode unit). The derived values appear in the Defaults block but are **not persisted until the user saves the routine** — so a "just opened the editor and closed" interaction doesn't silently change stored data.

**Stack**: React 18, TypeScript (strict), Tailwind CSS. No new dependencies.

## Architecture

```
src/frontend/apps/workout/

  types.ts                                           (extend)
  └── Routine.defaults?: RoutineDefaults
  └── new type RoutineDefaults = {
         sets?: number
         reps?: string
         restSeconds?: number
         weightUnit?: WeightUnit
      }

  utils.ts                                           (extend)
  ├── median(numbers: number[]): number | undefined
  ├── mode<T>(values: T[]): T | undefined
  └── deriveDefaults(routine: Routine): RoutineDefaults
       — pure; never reads or writes state

  RoutineEditor.tsx                                  (edit)
  ├── local state: defaults (RoutineDefaults), seeded from routine.defaults
  │   or deriveDefaults(routine) if undefined
  ├── new <DefaultsBlock /> sub-component above exercise list
  ├── handlePick uses defaults to set initial sets/reps/rest/weightUnit
  │   on new picks (falls back to current hard-coded values per field)
  ├── per-row ⇪ button next to Sets, Reps, Rest inputs that calls
  │   applyToAll(key, value)
  └── handleSave writes defaults into the saved Routine
```

## Output format

### 1. `src/frontend/apps/workout/types.ts` (extend)

```ts
export interface RoutineDefaults {
  sets?: number
  reps?: string
  restSeconds?: number
  weightUnit?: WeightUnit
}

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
  createdAt: number
  updatedAt: number
  isStarter?: boolean
  defaults?: RoutineDefaults   // NEW — Phase 5b
}
```

Schema is additive. Existing routines round-trip unchanged.

### 2. `src/frontend/apps/workout/utils.ts` (extend)

Add three helpers. Keep them pure — no React imports.

```ts
export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function mode<T extends string | number | undefined>(
  values: T[],
): T | undefined {
  const counts = new Map<T, number>()
  for (const v of values) {
    if (v === undefined) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best: T | undefined = undefined
  let bestN = 0
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v
      bestN = n
    }
  }
  return best
}

import type { Routine, RoutineDefaults } from './types'

export function deriveDefaults(routine: Routine): RoutineDefaults {
  if (routine.exercises.length === 0) return {}
  return {
    sets: median(routine.exercises.map((e) => e.sets)),
    reps: mode(routine.exercises.map((e) => e.reps)),
    restSeconds: median(routine.exercises.map((e) => e.restSeconds)),
    weightUnit: mode(routine.exercises.map((e) => e.weightUnit)),
  }
}
```

Tie-breaking in `mode`: first value encountered (stable iteration order via `Map`). That's intentional — the function only needs to be deterministic and reasonable.

### 3. `src/frontend/apps/workout/RoutineEditor.tsx` (edit)

**State**:

```ts
const [defaults, setDefaults] = useState<RoutineDefaults>(() => {
  if (routine?.defaults) return { ...routine.defaults }
  // Migration: derive from existing rows. Display-only until user saves.
  if (routine && routine.exercises.length > 0) return deriveDefaults(routine)
  return {}
})
```

(For a brand-new routine, `defaults` starts empty; the Defaults block still shows its inputs so the user can pre-set them before adding exercises.)

**New picks inherit defaults** — update `handlePick`:

```ts
function handlePick(ex: Exercise) {
  setItems((prev) => [
    ...prev,
    {
      exerciseId: ex.id,
      sets: defaults.sets ?? 3,
      reps: defaults.reps ?? '10',
      restSeconds: defaults.restSeconds ?? 60,
      weightUnit: defaults.weightUnit,
    },
  ])
  setPickerOpen(false)
}
```

**Apply-to-all** — single helper that maps over `items`:

```ts
function applyToAll(field: 'sets' | 'reps' | 'restSeconds', value: number | string) {
  setItems((prev) => prev.map((it) => ({ ...it, [field]: value })))
}
```

**Defaults block** — a new sub-component inside this file (or inline JSX, your call — keep close to the rest of the form for clarity). Place above the "Exercises (N)" header.

Layout (collapsible — collapsed by default unless the routine actually has `defaults` already; expand-on-click to keep the editor focused):

```
┌────────────────────────────────────────────────────┐
│ Defaults for new exercises               [Expand ▼]│   ← header row
└────────────────────────────────────────────────────┘
                ↓ (when expanded)
┌────────────────────────────────────────────────────┐
│ Defaults for new exercises               [Collapse ▲]│
│                                                    │
│ [Sets 3] [Reps 10] [Rest 60s] [Unit kg|lb]        │
│                                                    │
│ New picks inherit these. Existing rows aren't      │
│ changed — use the ⇪ icon on any row to apply      │
│ that row's value to every other row.               │
└────────────────────────────────────────────────────┘
```

The unit toggle is the same segmented kg/lb control used elsewhere. Each numeric field updates `defaults` immediately via `setDefaults`.

**Per-row ⇪ apply-to-all** — add a small icon button immediately to the right of each of Sets, Reps, Rest inputs (inside the existing grid cell, not adding a new column). On click → `applyToAll(field, it[field])`.

```
┌────────────────────────────────────────────────────┐
│ Sets    Reps    Rest (s)                          │
│ [ 4 ]⇪ [ 5 ]⇪  [120 ]⇪                            │  ← ⇪ button anchored right
└────────────────────────────────────────────────────┘
```

Icon: `⇪` (U+21EA, single character). 24 × 24 px hit target with hover/focus styles consistent with the existing ▲ ▼ controls. `title="Apply to all rows"` for tooltip + `aria-label`.

**Save** — `handleSave` includes `defaults` on the saved Routine:

```ts
const saved: Routine = {
  id: routine?.id ?? generateId(),
  name: name.trim(),
  exercises: items,
  defaults: Object.keys(defaults).length > 0 ? defaults : undefined,
  createdAt: routine?.createdAt ?? now,
  updatedAt: now,
}
```

Stripping `defaults` to `undefined` when empty keeps serialised routines tidy.

### 4. Starter routines and migration

- **Don't** retroactively write `defaults` into the persisted `snappet:workout:routines` blob on app start. Migration happens lazily inside the editor only, on the in-memory `defaults` state. The user "owns" the migration by saving.
- **Don't** modify `starters.ts`. Starter routines stay defaults-free until a user edits them.

### 5. Auto-collapse default open state

The Defaults block defaults to **collapsed** so the first-time UX matches today's editor. We expose it as a small affordance, not as a wall. Two exceptions where it opens by default:
- The routine already has `defaults` saved (user has used the feature before).
- The user just tapped "+ Add exercise" on a routine with 0 rows — surface the defaults so the very first pick inherits sensible values.

Implement with a `useState(open)` initialised from those rules; no need to persist the open/closed state across sessions.

## Quality criteria

- **Backwards-compatible storage**: existing `snappet:workout:routines` blob (without `defaults`) round-trips and behaves identically until the user touches the editor and saves.
- **Predictable defaults**: `deriveDefaults` is deterministic on a given routine; pure function, easy to unit-test if we wanted to (don't add tests in this PR).
- **No UI regressions**: rest of the editor (sets/reps/rest inputs, weight collapse, notes collapse, rename, reorder, remove) all behave unchanged.
- **Tap targets**: ⇪ buttons ≥ 24 × 24 px; Defaults header tap target ≥ 44 × 44 px.
- **No new dependencies**.
- **Mobile**: the Defaults block stays on a single horizontal row on `sm+`, wraps cleanly on `<sm`.

## Don't change

- The starter routines list (`starters.ts`).
- localStorage key names.
- The Player, Browser, Picker, History, SessionDetail surfaces. (5b is editor-only.)
- The Phase 5a additions (search, sticky unit, rename, Settings).

## Acceptance (mirrors issue #38)

- [ ] `RoutineEditor` shows a "Defaults for new exercises" block above the exercise list
- [ ] Picking a new exercise inherits `defaults.sets`, `defaults.reps`, `defaults.restSeconds`, `defaults.weightUnit`
- [ ] Each per-row Sets, Reps, Rest input has a ⇪ button; tapping it sets every other row to the same value
- [ ] Saving the routine persists `defaults` (verify via DevTools localStorage)
- [ ] Existing routines without `defaults` continue to render and start workouts unchanged
- [ ] Opening an existing routine without `defaults` pre-populates the Defaults block via `deriveDefaults` (display only; saving makes it permanent)
- [ ] `tsc --noEmit` clean; `vite build` clean

## Next step

After 5b merges: write `31-workout-05c-progress-essentials.md` — promote `ExerciseProgress` into `ExerciseDetail` with a stat panel + PR marker, and add the curated 100-exercise Essentials list with an All-toggle in `ExerciseBrowser`.
