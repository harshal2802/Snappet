# Prompt: Workout app — Phase 5a: Quick wins (search, sticky unit, rename, Settings)

**File**: pdd/prompts/features/workout/29-workout-05a-quick-wins.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Chain**: 5a of 5 — first of three feedback PRs
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Issue**: #38
**Depends on**: Phases 1–4 (shipped) — uses existing `Exercise`, `Routine`, `RoutineExercise`, `WorkoutSession` types and the established tab pattern.

## Context

Round-one user feedback (issue #38) surfaced five issues. This PR closes three of them — the additive, schema-light ones — in one go:

1. **Smarter search** — `inclined bench press` currently returns 0 because the dataset spells it `Incline`. Today's search is `name.toLowerCase().includes(term)` and only looks at name.
2. **Sticky weight unit** — `WorkoutPlayer` resets the kg/lb toggle per exercise; user's `lb` choice is forgotten.
3. **Exercise rename inside a routine** — feedback verbatim: "let user change the name of the exercise if needed".
4. **Settings tab** — surface for the preferred-unit toggle (and room to grow). Decision: fourth top-level tab.

PRs 5b (routine defaults) and 5c (Essentials + progress dashboard) follow in separate prompts.

**Stack**: React 18, TypeScript (strict), Tailwind CSS. No new dependencies.

## Architecture

```
src/frontend/apps/workout/

  search.ts                                          (new — token + stem matcher)
  ├── stem(word)            strip trailing s|es|ed|ing|d (≥3 char remaining)
  ├── tokenize(text)        lower, split on non-alnum
  ├── buildSearchBag(ex)    {tokens from name + primaryMuscles + secondaryMuscles + equipment + category}
  └── matchesQuery(bag, query)  every stemmed query token has SOME bag token starting with it

  ExerciseBrowser.tsx                                (edit — use matchesQuery; cache bags per-exercise)
  ExercisePicker.tsx                                 (edit — same)

  types.ts                                           (extend)
  └── RoutineExercise.displayName?: string

  utils.ts                                           (extend)
  └── getDisplayName(routineExercise, exercise)      displayName ?? exercise.name ?? `(${exerciseId})`

  RoutineEditor.tsx                                  (edit)
  ├── ✏ rename button per row (next to ▲ ▼ ×)
  └── inline rename row (textarea-style — no modal — keeps single-screen edit flow)

  RoutineList.tsx, WorkoutPlayer.tsx,
  HistoryView.tsx, SessionDetail.tsx                 (edit — use getDisplayName)

  index.tsx                                          (edit — add 'settings' tab)
  ├── Tab = 'browse' | 'routines' | 'history' | 'settings'
  └── tab === 'settings' → <SettingsView />

  SettingsView.tsx                                   (new)
  ├── reads/writes snappet:workout:preferred-unit
  └── kg / lb segmented toggle (clear placeholder for future prefs)

  WorkoutPlayer.tsx                                  (edit)
  ├── on session entry & exercise change: prefer preferred-unit over hard-coded 'kg' default
  └── on user unit toggle: write preferred-unit
```

## Output format

### 1. `src/frontend/apps/workout/search.ts` (new)

Pure module — no React. Exports:

```ts
export function stem(word: string): string
export function tokenize(text: string): string[]
export function buildSearchBag(ex: Exercise): string[]
export function matchesQuery(bag: string[], query: string): boolean
```

`stem`:
- lower-case input
- if `length >= 5` and ends with `ing` → drop `ing`
- else if `length >= 4` and ends with `ed` → drop `ed`
- else if `length >= 4` and ends with `es` → drop `es`
- else if `length >= 4` and ends with `s` → drop `s`
- else if `length >= 4` and ends with `d` → drop `d` (this is what fixes `inclined` → `incline`)
- return result

`tokenize`:
- `text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)`

`buildSearchBag`:
- collect words from `name`, `primaryMuscles`, `secondaryMuscles`, `equipment`, `category`
- run `tokenize` on the joined string, then `stem` each token
- dedupe with a `Set`
- return as `string[]`

`matchesQuery`:
- if `query.trim() === ''` → return `true`
- tokenize+stem the query
- every query token must have at least one bag token where `bagToken.startsWith(queryToken)` (prefix match — lets `bench` find `benches`'s stem `bench` etc., already covered, but also makes `inclin` find `incline`)
- return boolean

### 2. `src/frontend/apps/workout/ExerciseBrowser.tsx` (edit)

Replace the inline name-only filter in `filtered` with a precomputed bag map:

```ts
const bagsById = useMemo(() => {
  const m = new Map<string, string[]>()
  if (!exercises) return m
  for (const ex of exercises) m.set(ex.id, buildSearchBag(ex))
  return m
}, [exercises])

const filtered = useMemo(() => {
  if (!exercises) return []
  return exercises.filter((ex) => {
    if (!matchesQuery(bagsById.get(ex.id) ?? [], searchTerm)) return false
    return matchesFilters(ex, filters)
  })
}, [exercises, searchTerm, filters, bagsById])
```

No UI change — search input and pill filters stay as-is.

### 3. `src/frontend/apps/workout/ExercisePicker.tsx` (edit)

Same treatment — build a bag map memoized on `exercises`, swap the name-only check for `matchesQuery`. Keep all existing filter / UI behaviour.

### 4. `src/frontend/apps/workout/types.ts` (extend)

Add `displayName?: string` to `RoutineExercise`. Schema is purely additive — existing routines deserialize unchanged.

```ts
export interface RoutineExercise {
  exerciseId: string
  sets: number
  reps: string
  restSeconds: number
  weight?: number
  weightUnit?: WeightUnit
  notes?: string
  displayName?: string   // NEW — Phase 5a
}
```

### 5. `src/frontend/apps/workout/utils.ts` (extend)

Add a single helper:

```ts
export function getDisplayName(
  routineExercise: { exerciseId: string; displayName?: string } | undefined,
  exercise: Exercise | undefined,
): string {
  return (
    routineExercise?.displayName?.trim() ||
    exercise?.name ||
    `(${routineExercise?.exerciseId ?? 'unknown'})`
  )
}
```

The helper accepts a structural-typed routineExercise so it also works for `SessionExercise` rows (which carry `exerciseId` but no `displayName` — they snapshot the routine's `displayName` at session start; see step 8).

### 6. `src/frontend/apps/workout/RoutineEditor.tsx` (edit)

Per row, add a ✏ icon between the ▼ and × buttons (3-button group becomes 4-button). Tapping it expands an inline rename strip below the sets/reps/rest row (consistent with the existing "Add weight" / "Add note" inline expanders — no modal):

```
┌────────────────────────────────────────────────────┐
│ 📷 Barbell Bench Press        ▲ ▼ ✏ ×            │
│ [Sets 4] [Reps 5] [Rest 120s]                     │
│ + Add weight   + Add note                          │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │ ← visible when ✏ active
│ │ Custom name (shown during workout & history) │  │
│ │ [ Heavy bench                              ] │  │
│ │ Original: Barbell Bench Press                │  │
│ │ [Reset to original]                  [✕ Close]│  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

State: a per-row `Set<number>` for `renameOpen`, same pattern as `weightOpen` / `notesOpen` (and propagate the same index re-mapping in `removeItem`).

- The input edits `it.displayName`.
- Empty / whitespace input → `displayName = undefined` (falls back to original).
- "Reset to original" sets `displayName` to `undefined`.
- "Close" just collapses the strip without resetting.

The row title `<p>` continues to render `ex?.name ?? '(unknown)'` — leave the editor showing the catalog name so the user always knows what they're renaming.

### 7. Display surfaces use `getDisplayName`

These four files swap their `ex?.name ?? '...'` rendering for `getDisplayName(routineExercise, ex)`. Where they currently iterate over `routine.exercises` or `session.exercises`, pass the row + the looked-up `Exercise` into the helper:

- `RoutineList.tsx` — the per-routine thumbnail row showing exercise names
- `WorkoutPlayer.tsx` — the big `<h2>` title (line ~427), the "Next: …" label in `RestStep` (~503), set-pip aria-label
- `HistoryView.tsx` — the thumbnail title prop (~143) if it shows names
- `SessionDetail.tsx` — every place that renders an exercise name

### 8. `WorkoutSession` snapshots `displayName` at session start

In `index.tsx`'s `onStartRoutine`, when building each `SessionExercise`, **copy the routine's `displayName`** so renaming a routine later doesn't retroactively change historic sessions. Add a `displayName?: string` field to `SessionExercise` (purely additive):

```ts
// types.ts — extend SessionExercise
export interface SessionExercise {
  exerciseId: string
  targetSets: number
  targetReps: string
  targetRestSeconds: number
  targetWeight?: number
  targetWeightUnit?: WeightUnit
  sets: SetLog[]
  skipped?: boolean
  displayName?: string   // NEW — snapshot at session start
}

// index.tsx — onStartRoutine
exercises: r.exercises.map((re) => ({
  exerciseId: re.exerciseId,
  targetSets: re.sets,
  targetReps: re.reps,
  targetRestSeconds: re.restSeconds,
  targetWeight: re.weight,
  targetWeightUnit: re.weightUnit,
  displayName: re.displayName,   // NEW
  sets: Array.from({ length: re.sets }, () => ({} as SetLog)),
})),
```

`getDisplayName` already accepts either shape (its first parameter is structurally typed).

### 9. `src/frontend/apps/workout/SettingsView.tsx` (new)

Standalone tab body, similar visual weight to `HistoryView`'s header.

Props:
```ts
interface SettingsViewProps {
  preferredUnit: WeightUnit
  setPreferredUnit: (u: WeightUnit) => void
}
```

Layout:
- Section header: "Settings"
- One card: **Preferred weight unit** — segmented kg / lb toggle (same look as the per-row unit toggle in RoutineEditor)
- Helper text below the toggle: "Used as the default for new sets across the app. You can override per set."
- Below: an empty-friendly "More settings coming soon." line — sets the tone for 5b/5c additions without leaving placeholder UI.

No save button — toggling writes immediately via `useLocalStorage`.

### 10. `src/frontend/apps/workout/index.tsx` (edit)

Add to `Tab`:
```ts
type Tab = 'browse' | 'routines' | 'history' | 'settings'
```

Add a fourth tab button: **Settings** (no badge). Wire body branch:

```tsx
{tab === 'settings' && (
  <SettingsView
    preferredUnit={preferredUnit}
    setPreferredUnit={setPreferredUnit}
  />
)}
```

Add the persistence at the orchestrator level so `WorkoutPlayer` can read+write it too:

```ts
const [preferredUnit, setPreferredUnit] = useLocalStorage<WeightUnit>(
  'snappet:workout:preferred-unit',
  'kg',
)
```

Pass it into `WorkoutPlayer`:

```tsx
<WorkoutPlayer
  session={activeSession}
  setSession={setActiveSession}
  exerciseById={exerciseById}
  preferredUnit={preferredUnit}
  setPreferredUnit={setPreferredUnit}
  onFinish={…}
  onAbandon={…}
/>
```

Also pre-fill the routine-start unit from `preferredUnit` (if the row has no explicit `weightUnit`) so the very first exercise of a session starts in the user's preferred unit even if the routine doesn't specify one. (Subtle: only fill it where the row currently has `weightUnit === undefined`.)

### 11. `src/frontend/apps/workout/WorkoutPlayer.tsx` (edit)

Two changes:

**a. Initial `unitInput` honours `preferredUnit`.** In the existing `useEffect` that pre-fills inputs when the current set changes, the fallback today is `'kg'`. Replace with the preferred unit:

```ts
// previous set had a unit? use it. otherwise prefer the routine's target,
// otherwise the global preferred-unit, otherwise 'kg'.
setUnitInput(prev?.weightUnit ?? currentExercise.targetWeightUnit ?? preferredUnit ?? 'kg')
```

(And the same swap in the `else` branch — the "fall back to targets" path.)

**b. Persist user toggles.** Wrap `setUnitInput` so user-driven unit changes also call `setPreferredUnit(u)`:

```tsx
const handleUnitChange = (u: WeightUnit) => {
  setUnitInput(u)
  setPreferredUnit(u)
}
// pass handleUnitChange to ExerciseStep instead of setUnitInput
```

(Only the WorkoutPlayer-level handler should write the preference. The RoutineEditor's per-row unit toggle stays per-row — that's the user setting a *plan*, not their preference.)

## Quality criteria

- **Type-strict**: no `any`, no unchecked casts; `displayName` plumbed through both `RoutineExercise` and `SessionExercise`; `WeightUnit` type unchanged.
- **No new deps**: search is hand-rolled; no Fuse.js / no migrations / no chart library changes.
- **Backwards-compatible storage**: existing `snappet:workout:routines` and `snappet:workout:history` blobs deserialise without error; new fields are all optional.
- **No regressions**: search still respects pill filters; rest timer, wake-lock, audio cue, vibration, skip-rest, end-session-save flows untouched in Player except the unit handler.
- **Mobile-friendly**: 44 px+ tap targets on ✏ icon and Settings tab button; segmented unit toggle remains pixel-identical to existing pattern.
- **Tab order**: Browse → Routines → History → Settings. Reset button still only on Browse.

## Don't change

- The free-exercise-db dataset and CDN setup (`data.ts`, `ExerciseImage.tsx`).
- The drift-free rest timer in `WorkoutPlayer`.
- The Phase 4 `ExerciseProgress` SVG chart (Phase 5c will extend it; not this PR).
- The starter routines list (`starters.ts`).
- localStorage key names other than the new `snappet:workout:preferred-unit`.

## Acceptance (mirrors issue #38)

- [ ] Search `inclined bench press` in Browser and Picker returns ≥1 result
- [ ] Search `biceps` returns biceps exercises (matched via muscle, not name)
- [ ] Search still excludes results when active pill filters disagree
- [ ] Toggling unit during a session updates `snappet:workout:preferred-unit`
- [ ] After a page reload, new sessions default to the last-used unit
- [ ] Settings tab shows the kg/lb toggle and reflects the live preference
- [ ] In RoutineEditor, ✏ opens an inline rename strip; empty or "Reset to original" restores the catalog name
- [ ] Renamed exercise shows in WorkoutPlayer header, RoutineList preview, History thumbnails, SessionDetail
- [ ] Existing routines and history persisted before this PR continue to render unchanged
- [ ] No new console errors; type-check passes

## Next step

After 5a merges: write `30-workout-05b-routine-defaults.md` (routine-level defaults + apply-to-all affordance).
