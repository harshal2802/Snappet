# Prompt: Workout app — Phase 2: Routine Builder + Starter Routines

**File**: pdd/prompts/features/workout/26-workout-02-routines.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Chain**: 2 of 4 — depends on Phase 1 being merged
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Research**: `pdd/context/research/workout-app.md`
**Depends on**: `pdd/prompts/features/workout/25-workout-01-browser.md` (merged in PR #30)

## Context

Phase 1 shipped a read-only exercise catalog at `/workout`. Phase 2 turns it into a workout *planner* by adding routines — ordered lists of exercises with per-exercise sets/reps/rest/weight targets. Five to six hand-curated starter routines seed on first run so the user has something to work with immediately. Phase 3 (next) will add the player that executes a routine.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, Vite. No new runtime deps — `@dnd-kit/core` is already in `package.json` (from Kanban) but **we won't use it for Phase 2 reordering** (mobile-friendly arrow buttons are simpler and avoid the touch DnD complexity we debugged in PR #23–#24).

**Existing files from Phase 1**:
- `src/frontend/apps/workout/types.ts` — `Exercise`, enums
- `src/frontend/apps/workout/data.ts` — `loadExercises()`, `exerciseImageUrl()`
- `src/frontend/apps/workout/ExerciseImage.tsx`, `ExerciseCard.tsx`, `ExerciseDetail.tsx`
- `src/frontend/apps/workout/index.tsx` — currently the single browser view

## Architecture

```
index.tsx
├── persisted: tab ('browse' | 'routines'), search, filters (from Phase 1), routines, startersSeeded
├── derived: exercises (lazy-loaded once), exerciseById Map for O(1) lookup
└── view branches on tab:
    ├── 'browse' → existing Phase 1 catalog code (refactored into <ExerciseBrowser />)
    └── 'routines' → either <RoutineList /> OR <RoutineEditor /> based on internal editingId state

starters.ts
└── STARTER_ROUTINES: Routine[] — 5–6 curated routines using verified-existing exercise IDs

RoutineList.tsx        — show routines, Edit / Duplicate / Delete actions, optional onStart
RoutineEditor.tsx      — name input + ordered exercise list + per-row controls + Add button
ExercisePicker.tsx     — modal/sheet that lets you tap exercises from the catalog to add
```

## Output format

### 1. `src/frontend/apps/workout/types.ts` (extend)

Append (don't replace existing) — the file ends with `ExerciseFiltersSerialized`:

```ts
export type WeightUnit = 'kg' | 'lb'

export interface RoutineExercise {
  // The exercise ID from Free Exercise DB (matches Exercise.id).
  exerciseId: string
  // Target sets (1 to 20). Stored as an integer.
  sets: number
  // Target reps per set. Stored as a string so users can type "8-12" or
  // "AMRAP" without breaking the input. Renderers should treat as opaque.
  reps: string
  // Rest between sets in seconds. 0 = no rest.
  restSeconds: number
  // Target weight, optional. Empty/zero means bodyweight or no specific load.
  weight?: number
  weightUnit?: WeightUnit
  // Free-form notes per exercise.
  notes?: string
}

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
  createdAt: number
  updatedAt: number
  // True for routines seeded as starters; UI may treat them slightly differently
  // (e.g. "duplicate" instead of "edit" as the primary action). User can delete
  // them — they don't re-seed.
  isStarter?: boolean
}
```

### 2. `src/frontend/apps/workout/starters.ts` (new)

Five to six curated routines. **The implementer MUST verify each `exerciseId` exists in the bundled `public/exercises.json`** before committing — use `grep` or a small Node one-liner. If the exact name isn't there, pick the closest match. The Free Exercise DB uses underscored title-case IDs (e.g. `Air_Squat`, `Pushups`, `Plank`).

Suggested routines + the kind of exercise to match for each slot:

```ts
export const STARTER_ROUTINES_SPEC = [
  {
    name: 'Beginner Full Body',
    exercises: [
      { match: 'Air Squat (bodyweight squat)', sets: 3, reps: '12', restSeconds: 60 },
      { match: 'Push-up (bodyweight)', sets: 3, reps: '10', restSeconds: 60 },
      { match: 'Bent-over Row (dumbbell, optional)', sets: 3, reps: '10', restSeconds: 60 },
      { match: 'Plank (timed, "30s")', sets: 3, reps: '30s', restSeconds: 45 },
      { match: 'Glute Bridge', sets: 3, reps: '12', restSeconds: 45 },
    ],
  },
  {
    name: 'Upper Body Push',
    exercises: [
      { match: 'Push-up', sets: 4, reps: '8-12', restSeconds: 90 },
      { match: 'Overhead Press (dumbbell)', sets: 4, reps: '8-10', restSeconds: 90 },
      { match: 'Tricep Dip', sets: 3, reps: '10', restSeconds: 60 },
      { match: 'Lateral Raise (dumbbell)', sets: 3, reps: '12', restSeconds: 45 },
    ],
  },
  {
    name: 'Upper Body Pull',
    exercises: [
      { match: 'Pull-up or Inverted Row', sets: 4, reps: '6-10', restSeconds: 90 },
      { match: 'Bicep Curl (dumbbell)', sets: 3, reps: '12', restSeconds: 60 },
      { match: 'Face Pull (cable)', sets: 3, reps: '15', restSeconds: 45 },
    ],
  },
  {
    name: 'Lower Body',
    exercises: [
      { match: 'Goblet Squat or Air Squat', sets: 4, reps: '10', restSeconds: 90 },
      { match: 'Lunge', sets: 3, reps: '10 each leg', restSeconds: 60 },
      { match: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 90 },
      { match: 'Calf Raise', sets: 3, reps: '15', restSeconds: 30 },
    ],
  },
  {
    name: 'Core Crusher',
    exercises: [
      { match: 'Plank', sets: 3, reps: '45s', restSeconds: 45 },
      { match: 'Russian Twist', sets: 3, reps: '20', restSeconds: 30 },
      { match: 'Dead Bug', sets: 3, reps: '10 each side', restSeconds: 30 },
      { match: 'Hollow Hold or Leg Raise', sets: 3, reps: '30s', restSeconds: 45 },
    ],
  },
  {
    name: '5-Minute Mobility',
    exercises: [
      { match: 'Cat-Cow Stretch or Spinal Stretch', sets: 1, reps: '60s', restSeconds: 0 },
      { match: 'World\'s Greatest Stretch or Lunge Stretch', sets: 1, reps: '30s each side', restSeconds: 0 },
      { match: 'Hamstring Stretch', sets: 1, reps: '30s each leg', restSeconds: 0 },
      { match: 'Shoulder/Arm Circles', sets: 1, reps: '60s', restSeconds: 0 },
    ],
  },
] as const
```

Resolve each `match` to an actual `exerciseId` from the dataset. The committed `starters.ts` should export:

```ts
import type { Routine } from './types'

export const STARTER_ROUTINES: Routine[] = [
  {
    id: 'starter-beginner-full-body',
    name: 'Beginner Full Body',
    isStarter: true,
    createdAt: 0,
    updatedAt: 0,
    exercises: [
      { exerciseId: '<verified id>', sets: 3, reps: '12', restSeconds: 60 },
      // …
    ],
  },
  // … other 5 routines
]
```

(`createdAt: 0` is intentional — starters predate the user; sort still works.)

### 3. `src/frontend/apps/workout/index.tsx` (refactor)

Move the existing browser code into a new component `<ExerciseBrowser />` inside the file (or a sibling file — pick whichever keeps the diff readable). The default export `Workout` becomes a tabs orchestrator:

```ts
type Tab = 'browse' | 'routines'

const [tab, setTab] = useLocalStorage<Tab>('snappet:workout:tab', 'browse')
const [routines, setRoutines] = useLocalStorage<Routine[]>('snappet:workout:routines', [])
const [startersSeeded, setStartersSeeded] = useLocalStorage<boolean>(
  'snappet:workout:starters-seeded',
  false,
)

// Seed starters once
useEffect(() => {
  if (!startersSeeded) {
    setRoutines((prev) => [...STARTER_ROUTINES, ...prev])
    setStartersSeeded(true)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// Lazy-load exercises so child views don't each fetch
const [exercises, setExercises] = useState<Exercise[] | null>(null)
useEffect(() => { loadExercises().then(setExercises).catch(/* keep null */) }, [])
const exerciseById = useMemo(
  () => new Map((exercises ?? []).map((e) => [e.id, e])),
  [exercises],
)
```

Layout:
- The existing header (title "Workout" + Reset) stays at the top
- Immediately below the header: a 2-button segmented tab control (Browse | Routines) — full-width on mobile, content-width on desktop
- Body renders one of:
  - `<ExerciseBrowser exercises={exercises} exerciseById={exerciseById} ... />`
  - `<RoutinesView routines={routines} setRoutines={setRoutines} exerciseById={exerciseById} />` — a wrapper that internally renders either `<RoutineList />` or `<RoutineEditor />` based on its own `editingId` state

Reset behaviour:
- In Browse tab: existing behaviour (clear search/filters/selected)
- In Routines tab: NO destructive reset by default — don't delete user routines. The Reset button is shared, so check the active tab. On Routines tab, Reset can be a no-op OR could re-seed any deleted starters (probably overkill — keep it a no-op with a tooltip explaining it only resets the browse view).

### 4. `src/frontend/apps/workout/RoutineList.tsx` (new)

Props:
```ts
interface RoutineListProps {
  routines: Routine[]
  exerciseById: Map<string, Exercise>
  onNew: () => void
  onEdit: (routineId: string) => void
  onDuplicate: (routineId: string) => void
  onDelete: (routineId: string) => void
  onStart?: (routineId: string) => void  // Phase 3 will provide this; v2 hides the button if undefined
}
```

Render:
- "New Routine" primary button at top-right of the list header
- If `routines.length === 0` — empty state with a Create button
- One card per routine, vertical stack. Each card:
  - Name (large), `isStarter` badge if applicable (tiny pill "Starter")
  - Meta line: `N exercises · ~M min estimated` (estimate = sum of sets × (30s active + restSeconds) per exercise, rounded to nearest minute; floor 1)
  - First 3 exercise thumbnails (24×24 px) horizontally; "+ N more" if more
  - Action buttons on the right: `Start` (only if `onStart` provided), `Edit`, `⋯` overflow menu for `Duplicate`/`Delete`
  - Delete prompts a small confirm (inline `confirm()` is acceptable; or a tiny custom inline confirm pill)

Mobile-friendly: stack actions below the name on narrow widths.

### 5. `src/frontend/apps/workout/RoutineEditor.tsx` (new)

Props:
```ts
interface RoutineEditorProps {
  // null = creating a new routine; otherwise editing an existing one
  routine: Routine | null
  exerciseById: Map<string, Exercise>
  onSave: (routine: Routine) => void
  onCancel: () => void
  onDelete?: (routineId: string) => void  // shown when editing an existing routine
}
```

Local state mirrors the routine being edited (immutable updates). On Save, callback with the full updated routine (regenerate `updatedAt`); on Cancel, close without persisting.

Layout (`max-w-2xl mx-auto space-y-4`):
- Header row: ← Back arrow on the left, "Edit Routine" / "New Routine" title, Save button on the right (primary, disabled if name empty or exercises empty)
- Name input (large, inline-edit feel)
- Section title "Exercises" + an `+ Add exercise` button that opens the picker
- Ordered list of `<RoutineExerciseRow />` (inline sub-component, no separate file unless it grows):
  - Drag handle? **No.** Use up (▲) / down (▼) arrow buttons — disabled at top/bottom respectively. Why: drag-to-reorder on touch was a real source of pain (PRs #23/#24 history); arrows always work, always discoverable.
  - Thumbnail (40×40, via `<ExerciseImage>`)
  - Exercise name (truncated)
  - Compact 3-input row: Sets (number), Reps (text), Rest (number with "s" suffix label)
  - "Weight" toggle that, when expanded, shows weight + kg/lb pills
  - Notes textarea (collapsed by default; reveal via "Add note" link)
  - Remove (×) at the far right
- Delete routine link (small, danger color) at the bottom-left, only when editing an existing routine

### 6. `src/frontend/apps/workout/ExercisePicker.tsx` (new)

Modal/full-screen sheet on mobile; side modal on desktop.

Props:
```ts
interface ExercisePickerProps {
  exercises: Exercise[]            // pass loaded exercises
  alreadySelectedIds?: Set<string> // optional — show ✓ on currently-selected ones
  onPick: (exercise: Exercise) => void
  onClose: () => void
}
```

Render:
- Sticky header: title "Pick exercise" + ✕ close
- Search input + ALL four Phase-1 filter pills (Category/Level/Equipment/Muscle) — reuse the same FilterRow pattern. Persist this picker's local filters under `snappet:workout:picker-filters` (separate key from the browser's filters — different mental context).
- Result list — same `<ExerciseCard>` from Phase 1, but tapping doesn't open the detail; it calls `onPick(exercise)` and closes (or leaves open for "add multiple" if user holds shift / desktop only; out of scope for v1 — single-pick + reopen if they want more)
- Cards with IDs in `alreadySelectedIds` show a small ✓ badge

Reuses the same fetch cache from `data.ts` (no extra network).

### 7. `src/frontend/apps/workout/index.tsx` — wire RoutinesView

Inside `<RoutinesView />`:

```ts
const [editingId, setEditingId] = useState<string | null | 'new'>(null)
const editingRoutine = editingId && editingId !== 'new'
  ? routines.find((r) => r.id === editingId) ?? null
  : null

// Handlers
function handleSave(r: Routine) {
  setRoutines((prev) => {
    if (editingId === 'new') return [...prev, r]
    return prev.map((x) => (x.id === r.id ? r : x))
  })
  setEditingId(null)
}
function handleDelete(id: string) {
  setRoutines((prev) => prev.filter((r) => r.id !== id))
  if (editingId === id) setEditingId(null)
}
function handleDuplicate(id: string) {
  const src = routines.find((r) => r.id === id)
  if (!src) return
  const copy: Routine = {
    ...src,
    id: generateId(),
    name: `${src.name} (copy)`,
    isStarter: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  setRoutines((prev) => [...prev, copy])
}
```

Branching:
- `editingId === null` → `<RoutineList ...>`
- `editingId === 'new'` → `<RoutineEditor routine={null} ...>`
- `editingId === '<id>'` → `<RoutineEditor routine={editingRoutine} ...>`

Phase 2 does NOT wire `onStart` — Phase 3 will. The RoutineList card just doesn't show that button.

### 8. ID generation

Use the existing pattern from other apps (e.g. `apps/kanban-board/utils.ts`'s `generateId()`). If the workout folder doesn't have one, add a small `utils.ts`:

```ts
export function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}
```

## Acceptance criteria

- [ ] First load after merge: 6 starter routines appear in the Routines tab; `snappet:workout:starters-seeded` is `true`
- [ ] Deleting a starter routine and reloading: the deleted starter does NOT re-seed
- [ ] "New Routine" opens an empty editor; Save with no name or no exercises is disabled
- [ ] In the editor, "Add exercise" opens the picker; picking an exercise appends it; closing the picker returns to the editor
- [ ] Each exercise row: arrows reorder (▲ disabled on first row, ▼ disabled on last); × removes; sets/reps/rest inputs accept values
- [ ] Weight toggle expands kg/lb pills; per-set weight isn't required
- [ ] Save persists to `snappet:workout:routines`; visible in the list after returning
- [ ] Duplicate creates a copy with `(copy)` suffix and `isStarter: false`
- [ ] Delete with confirmation; the routine vanishes
- [ ] Browse tab still works exactly as Phase 1 (no regressions)
- [ ] Mobile (375 px): tab control fills width; editor scrolls; arrow + × tap targets ≥ 40 px
- [ ] Dark mode on all new elements
- [ ] `tsc --noEmit` clean; `npm run build` succeeds
- [ ] All starter routine `exerciseId`s actually exist in `public/exercises.json` (verify with `jq -r '.[].id' src/frontend/public/exercises.json | sort | grep -F '<id>'` per id, or a one-liner script)

## Constraints

- **No new dependencies.** Reorder via arrow buttons, not dnd-kit. (We have dnd-kit for Kanban but the drag UX is heavier than warranted here.)
- TypeScript strict; no `any`
- Dark mode + focus-visible rings on all new UI
- Tap targets ≥ 40 × 40 px on mobile
- Pure refactor of `index.tsx` — the Phase 1 browser code must continue to work identically. Easiest way: extract into `<ExerciseBrowser />` carrying the existing local state, no logic changes.
- **Phase 2 does not implement the player.** Just the planner. `onStart` prop on `RoutineList` is optional and unused.

## Test plan

1. `npm run dev`; open `/workout`
2. Tab switches to "Routines"; 6 starters present
3. Tap "Beginner Full Body" → editor opens with its exercises
4. Reorder a row up/down via arrows; save; reopen — order persisted
5. New Routine → empty editor → add 3 exercises via picker → set sets/reps/rest → save → appears in list
6. Duplicate it → "(copy)" present, can edit independently
7. Delete a starter → confirm → it's gone; reload, still gone
8. Switch to Browse → search and filters work as before
9. Reload — tab restored, routines restored, browse search/filters restored
10. Mobile (375 px) — all controls usable with one thumb
