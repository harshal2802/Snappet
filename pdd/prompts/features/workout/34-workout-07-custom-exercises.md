# Prompt: Workout app — Custom exercises (add your own + edit existing)

**File**: pdd/prompts/features/workout/34-workout-07-custom-exercises.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md` (Phase 7)
**Depends on**: All Workout phases shipped on `main` (1–6, plus sport-routines PR #46). Single additive PR.

## Goal

Let users **add their own exercises** to the catalog and **edit existing ones**. Today the
catalog is read-only: 800 exercises from the Free Exercise DB, loaded from static JSON
(`public/exercises.json` via `data.ts`). There is no way to add a gym-specific machine, a
movement variation, or anything not in the DB.

A custom exercise must be a first-class catalog citizen: searchable in **Browse**, pickable in
the **routine editor**, usable in the **Player**, and visible in **History / Dashboard** — with
no per-surface plumbing.

## Context — anchor to `main` as of PR #46

The whole app reads exercises through **one merged array → one `exerciseById` Map**, both built
in `apps/workout/index.tsx`. Every consumer (RoutineEditor, ExercisePicker, WorkoutPlayer,
HistoryView, SessionDetail, Dashboard) resolves exercises by id from that Map. **So merging
custom exercises into that array is the entire integration** — downstream surfaces need no
changes beyond the catalog UI itself.

Relevant existing shape:

- **`Exercise` type** (`types.ts`) mirrors the Free Exercise DB row:
  `id, name, force (nullable), level, mechanic (nullable), equipment, primaryMuscles[],
  secondaryMuscles[], instructions[], category, images[]`.
- **`data.ts`** — `loadExercises()` lazy-fetches + memoizes `public/exercises.json`. Image URLs
  come from `exerciseImageUrl()` (jsdelivr → githubusercontent fallback) inside `ExerciseImage`.
- **`index.tsx`** — loads the DB list into `exercises` state, builds
  `exerciseById = new Map(exercises.map((e) => [e.id, e]))`, and passes it to every tab.
  **Note the duplication**: `ExerciseBrowser` *also* calls `loadExercises()` itself (it does not
  consume the orchestrator's `exercises`). Both load paths must include customs.
- **`ExerciseCard.tsx`** — already guards `exercise.images[0] && <ExerciseImage/>`, so a custom
  exercise with `images: []` renders without a broken image; we add a real placeholder.
- **`ExerciseDetail.tsx`** — header has only name + ✕ close. `images.map(...)` over an empty
  array simply renders nothing.
- **`utils.ts`** — `generateId()` (9-char base36). `getDisplayName(...)` already falls back to
  `(${exerciseId})` for orphan rows, so deleting a referenced exercise degrades gracefully.
- **`RoutineExercise.exerciseId`, `SessionExercise.exerciseId`** reference `Exercise.id` —
  custom ids must never collide with DB ids (DB ids are long hyphenated slugs; `generateId()`
  is 9-char base36 — prefix custom ids to be safe; see below).

## Design decisions (assumed defaults — flag in PR for explicit confirmation)

1. **"Edit existing" = Customize-as-copy for DB exercises.** The 800 DB exercises are a shared
   static dataset and stay read-only. Editing a DB exercise = a **"Customize" action that
   creates an editable custom copy** (new id, prefilled from the DB entry, `images` dropped).
   Custom exercises themselves are fully editable in place. This avoids a fragile per-id
   override/shadow system and keeps existing routine/history references stable. (For the light
   "just rename it in this routine" case, per-row `displayName` from Phase 5a already exists.)
2. **No images for custom exercises in v1.** Show a clean placeholder (first letter of the name
   in a tinted tile). A future PR can add an image-URL / data-URL field.
3. **Storage**: `snappet:workout:custom-exercises` — `Exercise[]`, each with `isCustom: true`.
4. **Deleting a referenced custom exercise** is allowed but confirmed with a warning that names
   how many routines / history sessions reference it. Orphan rows degrade gracefully.
5. **Merge order**: custom exercises first, then DB — so a user's own exercises are easy to find
   at the top and shadow nothing.

## Output format

### 1. `src/frontend/apps/workout/types.ts` (extend, additive)

Add one optional field to `Exercise` (at the end of the interface; do not reorder existing
fields — DB JSON rows simply lack it):

```ts
export interface Exercise {
  // … existing fields stay exactly as-is …
  // True for user-created exercises stored in localStorage (not in the bundled
  // Free Exercise DB). Absent on DB rows.
  isCustom?: boolean
}
```

### 2. `src/frontend/apps/workout/customExercises.ts` (new)

```ts
import type {
  Equipment, Exercise, ExerciseCategory, ExerciseLevel, Force, Mechanic, Muscle,
} from './types'
import { generateId } from './utils'

export const CUSTOM_EXERCISES_KEY = 'snappet:workout:custom-exercises'

// Prefix keeps custom ids from ever colliding with DB slugs and makes them
// identifiable in routine/history references without a lookup.
export function newCustomExerciseId(): string {
  return `custom-${generateId()}`
}

// Build a blank custom exercise (used by "+ New exercise") or seed from a DB
// exercise (used by "Customize"). When seeding, pass the source's fields but
// always assign a fresh id, set isCustom, and drop CDN images.
export function makeCustomExercise(seed?: Partial<Exercise>): Exercise {
  return {
    id: newCustomExerciseId(),
    name: seed?.name ? `${seed.name} (custom)` : '',
    force: seed?.force ?? null,
    level: seed?.level ?? 'beginner',
    mechanic: seed?.mechanic ?? null,
    equipment: seed?.equipment ?? 'body only',
    primaryMuscles: seed?.primaryMuscles ? [...seed.primaryMuscles] : [],
    secondaryMuscles: seed?.secondaryMuscles ? [...seed.secondaryMuscles] : [],
    instructions: seed?.instructions ? [...seed.instructions] : [],
    category: seed?.category ?? 'strength',
    images: [], // custom exercises have no CDN images in v1
    isCustom: true,
  }
}

// Custom first (easy to find, top of the list), then the DB catalog.
export function mergeCatalog(db: Exercise[], custom: Exercise[]): Exercise[] {
  return [...custom, ...db]
}
```

Re-export the option arrays the editor and browser both need so they live in one place
(`ALL_CATEGORIES`, `ALL_LEVELS`, `ALL_EQUIPMENT`, `ALL_MUSCLES`, `ALL_FORCE`, `ALL_MECHANIC`)
— **or** keep them where they already are in `ExerciseBrowser.tsx` and import from there if
that's a smaller diff. Pick the lower-churn option; do not duplicate the literal arrays a third
time.

### 3. `src/frontend/apps/workout/ExerciseEditor.tsx` (new)

A full-screen modal form (mirror `ExercisePicker.tsx`'s modal shell: `fixed inset-0 z-50
bg-black/50 …`, sticky header with title + ✕, scrollable body, sticky footer with Cancel /
Save). Props:

```ts
interface ExerciseEditorProps {
  // null = creating new; an Exercise = editing that custom exercise.
  exercise: Exercise | null
  // Pre-filled draft when "Customize"-ing a DB exercise (already run through
  // makeCustomExercise). Optional; takes precedence over `exercise === null`.
  seed?: Exercise
  onSave: (exercise: Exercise) => void
  onCancel: () => void
  onDelete?: (id: string) => void   // only for editing an existing custom exercise
}
```

Fields (local state initialised from `exercise ?? seed ?? makeCustomExercise()`):
- **Name** — text input, required. Trim; block save when empty.
- **Category** — single-select chip row (`ALL_CATEGORIES`).
- **Level** — single-select chip row (`beginner | intermediate | expert`).
- **Equipment** — single-select chip row (`ALL_EQUIPMENT`).
- **Force** — single-select chip row with a "None" option mapping to `null` (`pull | push | static`).
- **Mechanic** — single-select chip row with a "None" option mapping to `null` (`compound | isolation`).
- **Primary muscles** — multi-select chip row (`ALL_MUSCLES`).
- **Secondary muscles** — multi-select chip row (`ALL_MUSCLES`).
- **Instructions** — a list of one-line inputs with add/remove (Enter on the last row adds a new
  one; × removes). Store as `string[]`, dropping blank lines on save. Keep it simple — reuse the
  tag-input interaction pattern from `RoutineEditor`'s metadata tags if convenient.

Reuse the existing pill classes (`PILL_BASE / PILL_ACTIVE / PILL_INACTIVE`) and chip-row layout
already used in `ExerciseBrowser` / `RoutineEditor` so it looks native. Single-select rows: tap
the active chip again to clear (where a None/clear state is meaningful). Tap targets ≥ 44 px.

On **Save**: build the `Exercise` (preserve `id` and `isCustom: true`; trim name; drop blank
instructions) and call `onSave`. On **Delete** (existing custom only): call `onDelete(id)` —
the parent owns the confirm + reference warning.

### 4. `src/frontend/apps/workout/index.tsx` — own custom state + merge + handlers

Add custom-exercise storage next to the other workout localStorage hooks:

```ts
const [customExercises, setCustomExercises] = useLocalStorage<Exercise[]>(
  CUSTOM_EXERCISES_KEY,
  [],
)
```

Merge into the catalog the orchestrator already loads, **before** building `exerciseById`:

```ts
const allExercises = useMemo(
  () => mergeCatalog(exercises, customExercises),
  [exercises, customExercises],
)
const exerciseById = useMemo(
  () => new Map(allExercises.map((e) => [e.id, e])),
  [allExercises],
)
```

Replace the existing `exercises`-based `exerciseById` with the merged one, and pass
`allExercises` (not the raw DB `exercises`) wherever the routines/picker path needs the full
catalog (`RoutinesView`'s `exercises` prop). Player/History/Dashboard already take
`exerciseById` — they get customs for free.

CRUD handlers (orchestrator owns them so both the Browse tab and any future caller share one
source of truth):

```ts
function handleSaveCustomExercise(ex: Exercise) {
  setCustomExercises((prev) => {
    const i = prev.findIndex((x) => x.id === ex.id)
    if (i === -1) return [...prev, ex]
    const next = [...prev]; next[i] = ex; return next
  })
}

function handleDeleteCustomExercise(id: string) {
  setCustomExercises((prev) => prev.filter((x) => x.id !== id))
  // Do NOT touch routines/history — orphan rows degrade via getDisplayName().
}
```

Pass `customExercises`, `handleSaveCustomExercise`, `handleDeleteCustomExercise`, and a small
helper to count references (below) down to `ExerciseBrowser`.

**Reference count helper** (for the delete-confirm warning) — define in `index.tsx` (or
`utils.ts` if cleaner) and pass the result-getter down:

```ts
function countExerciseReferences(id: string): { routines: number; sessions: number } {
  return {
    routines: routines.filter((r) => r.exercises.some((e) => e.exerciseId === id)).length,
    sessions: history.filter((s) => s.exercises.some((e) => e.exerciseId === id)).length,
  }
}
```

### 5. `src/frontend/apps/workout/ExerciseBrowser.tsx` — new-exercise CTA, merge, edit/delete

`ExerciseBrowser` currently loads its own DB list and owns selection. Extend it:

- **New props**:
  ```ts
  customExercises: Exercise[]
  onSaveCustom: (ex: Exercise) => void
  onDeleteCustom: (id: string) => void
  getReferenceCounts: (id: string) => { routines: number; sessions: number }
  ```
- **Merge** customs into the locally-loaded DB list with `mergeCatalog(dbList, customExercises)`
  before computing `bagsById` / `filtered` / `selected`. Customs are searchable and filterable
  exactly like DB rows (they have the same fields).
- **Essentials toggle**: custom exercises are NOT in `ESSENTIAL_ID_SET`, so they'd be hidden in
  the default Essentials view. Fix: in the `filtered` predicate, always keep customs regardless
  of `essentialsOnly` — `if (essentialsOnly && !ESSENTIAL_ID_SET.has(ex.id) && !ex.isCustom) return false`.
- **"+ New exercise" button** in the sticky control bar (e.g. next to Filters, or on its own row
  under the search). Opens `ExerciseEditor` with `exercise={null}`. On save → `onSaveCustom`,
  then select the new exercise so the user sees it land.
- **Editor wiring** — local state `const [editing, setEditing] = useState<{ mode: 'new' | 'edit' | 'customize'; exercise?: Exercise } | null>(null)`. Render `<ExerciseEditor/>` over the
  list when set.
- **Delete confirm** — when deleting a custom exercise, look up `getReferenceCounts(id)`; if any
  references exist, confirm with a message like *"Used in N routine(s) and M past session(s).
  Those will show the exercise id until you swap it out. Delete anyway?"* Use the app's existing
  confirm pattern (match how RoutineEditor / history destructive actions confirm — inline
  confirm or `window.confirm`, whichever the codebase already uses; do not introduce a new modal
  library).
- Pass through to `ExerciseDetail` (below): `onEdit`, `onDelete`, `onCustomize`.

### 6. `src/frontend/apps/workout/ExerciseDetail.tsx` — header actions + image placeholder

- **Header actions** (new optional props; render only when provided):
  ```ts
  onEdit?: () => void        // custom only
  onDelete?: () => void      // custom only
  onCustomize?: () => void   // DB only
  ```
  For a custom exercise (`exercise.isCustom`), show **Edit** + **Delete** buttons in the header
  next to ✕. For a DB exercise, show a **Customize** button (creates an editable copy). Keep them
  compact (icon or short text), ≥ 44 px tap target, dark-mode styled.
- **Custom badge** — small "Custom" pill near the name/metadata row when `isCustom`.
- **Image placeholder** — when `exercise.images.length === 0`, render a single tinted tile with
  the exercise's first letter (or a 🏋 glyph) instead of the empty image grid. Don't render the
  jsdelivr `<ExerciseImage>` for custom rows (there's no path).

### 7. `src/frontend/apps/workout/ExerciseCard.tsx` — placeholder + custom badge

- When `exercise.images[0]` is absent, render a placeholder thumbnail (first letter in the
  existing `w-20 h-20` tile) instead of an empty grey box.
- When `exercise.isCustom`, add a small "Custom" badge in the badge row (reuse the `text-[10px]`
  pill styling; e.g. `bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300`).

## Quality criteria

- **One merge, every surface.** A saved custom exercise appears in Browse, is pickable in the
  routine editor, plays in the Player (sets/reps/rest/weight all work), and shows in History +
  Dashboard — without per-surface changes beyond the catalog UI.
- **Backwards-compatible storage.** Absent `snappet:workout:custom-exercises` → `[]`. Existing
  `exercises.json` rows (no `isCustom`) render and behave identically. No migration.
- **No id collisions.** Custom ids are `custom-`-prefixed; never overlap DB slugs.
- **Orphan-safe deletion.** Deleting a referenced custom exercise leaves routines/history intact;
  rows fall back to `getDisplayName`'s `(id)` sentinel. Delete is confirmed with a reference count.
- **Customize-as-copy** never mutates the DB list or existing references.
- **No regressions** to: Browser search/filter/Essentials toggle/reset, Picker, RoutineEditor
  (defaults, rename, reorder), Player, History, SessionDetail, Dashboard, sport-routine search.
- **Tap targets ≥ 44 px** on every new chip, button, and instruction-row control on mobile.
- **No new dependencies.**
- **TS strict, no `any`.** `isCustom` typed; editor state fully typed.
- **Dark mode** on all new UI (editor, badges, placeholders, header actions).

## Don't change

- The `Exercise` field order (append `isCustom?` only).
- `data.ts` / `loadExercises()` / `exercises.json` — the DB stays read-only and untouched.
- `RoutineExercise` / `SessionExercise` schemas — custom exercises reuse `exerciseId` as-is.
- Tab structure (5 tabs).
- Phase 5a `displayName`, Phase 5b `defaults`, issue #35 sport metadata.
- The `ExerciseImage` jsdelivr/raw fallback behavior (custom rows just don't use it).

## Acceptance

- [ ] `Exercise.isCustom?: boolean` added (additive; DB rows unaffected)
- [ ] `customExercises.ts`: `CUSTOM_EXERCISES_KEY`, `newCustomExerciseId()`, `makeCustomExercise()`, `mergeCatalog()`
- [ ] Custom exercises persist under `snappet:workout:custom-exercises`
- [ ] `index.tsx` merges customs into `exerciseById` and the routines/picker catalog (customs first)
- [ ] Browse: "+ New exercise" opens the editor; saved exercise appears at the top, searchable + filterable
- [ ] Browse Essentials view still shows custom exercises (not filtered out by `ESSENTIAL_ID_SET`)
- [ ] ExerciseEditor: name (required), category, level, equipment, force/mechanic (with None),
      primary/secondary muscles, instructions list — all functional, TS-typed
- [ ] ExerciseDetail: Edit + Delete for custom; Customize for DB; "Custom" badge; image placeholder
- [ ] ExerciseCard: placeholder thumbnail + "Custom" badge for custom rows
- [ ] Customize a DB exercise → editable copy (new `custom-` id, prefilled, no images); DB entry unchanged
- [ ] Custom exercise pickable in RoutineEditor; routine using it starts + plays in WorkoutPlayer
- [ ] Completing a session with a custom exercise shows it in History + SessionDetail + Dashboard
- [ ] Deleting a referenced custom exercise warns with routine/session counts; orphan rows show `(id)`
- [ ] Mobile (375 px): editor scrolls, chip rows wrap, all controls one-thumb usable, tap targets ≥ 44 px
- [ ] Dark mode on all new UI
- [ ] `tsc --noEmit` clean; `npm run build` clean

## Test plan

1. `npm run dev` → `/workout` → Browse
2. "+ New exercise" → name "Gym Sled Push", category strength, equipment machine, level
   intermediate, primary muscles quadriceps + glutes, two instruction lines → Save. It appears at
   the top with a "Custom" badge + letter placeholder.
3. Search "sled" → it matches. Toggle Essentials → it still shows.
4. Open it → Detail shows Edit + Delete + Custom badge + placeholder image tile. Edit → change
   level to expert → Save → persists across reload.
5. Browse a DB exercise (e.g. "Barbell Squat") → Detail → "Customize" → editor prefilled with a
   new `custom-` id and name "Barbell Squat (custom)", no images. Save → both the original DB
   entry and the new custom copy exist.
6. Routines → New Routine → Pick exercise → search "sled" → add the custom exercise → set
   3×10 → Save → Start → Player shows it, log a set, Finish.
7. History → session lists the custom exercise by name; SessionDetail shows its sets; Dashboard
   counts it.
8. Delete the custom "Gym Sled Push" → confirm warns it's used in 1 routine + 1 session → confirm
   → routine/history rows now show the `(id)` fallback; no crash.
9. DevTools → `localStorage['snappet:workout:custom-exercises']` holds only the custom exercises,
   each with `isCustom: true` and a `custom-` id.
10. `tsc --noEmit` and `npm run build` both clean.

## Next step

Implement → `/project:pdd-review` → PR (branch `feat/workout-custom-exercises`) → confirm the two
flagged defaults (customize-as-copy; no images v1) with the user before merge.
