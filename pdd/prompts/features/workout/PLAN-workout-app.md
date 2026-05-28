# Implementation Plan: Workout app

**Created**: 2026-05-27
**Complexity**: High
**Estimated prompts**: 4

## Summary

Build the Workout mini-app as a 4-phase prompt chain. Adopts [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (~1 MB JSON, 800 exercises, lazy-loaded images via jsdelivr CDN). Each phase is one PR; each is independently usable. Phase 1 ships a useful exercise reference; Phase 2 adds routine planning; Phase 3 makes it a real workout app with rest timer + set logging; Phase 4 adds history + simple progress.

Research: `pdd/context/research/workout-app.md`
Decision log: `pdd/context/decisions.md` (2026-05-27 workout entry)

User-confirmed settings (from research step):
- Full 800-exercise catalog (not curated subset)
- Default weight unit: **kg** (toggle per-set to lb)
- Rest-timer end cue: **vibration + visual flash + audio beep** (Web Audio)
- All 4 phases planned

## Phases

### Phase 1 — Exercise Browser (read-only catalog)

**Produces**:
- `src/frontend/public/exercises.json` — bundled copy of Free Exercise DB (`dist/exercises.json`, ~1 MB)
- `src/frontend/apps/workout/types.ts` — `Exercise`, `ExerciseCategory`, `ExerciseLevel`, `Muscle`, `Equipment`, `Force`, `Mechanic` types
- `src/frontend/apps/workout/data.ts` — fetch+memoize the JSON on first use; helper indexes (by category, by muscle, by equipment)
- `src/frontend/apps/workout/ExerciseCard.tsx` — list-item card (name, equipment badge, level pill, first image thumbnail)
- `src/frontend/apps/workout/ExerciseDetail.tsx` — full-screen view with both images, instructions, muscles, equipment, level; lazy `<img>` from jsdelivr CDN
- `src/frontend/apps/workout/index.tsx` — root view: search box, multi-select filters (category / level / equipment / muscle), virtualized list of cards (or simple grid if list is short after filtering)
- Route entry `/workout`
- Attribution footer linking to https://github.com/yuhonas/free-exercise-db

**Depends on**: nothing (clean addition)

**Risk**: Medium — biggest data-driven UI in Snappet. List virtualization may be needed for the 800-row case; if not, document the perf budget.

**Prompt**: `pdd/prompts/features/workout/25-workout-01-browser.md`

---

### Phase 2 — Routine Builder + Starter Routines

**Produces**:
- `src/frontend/apps/workout/types.ts` (extended) — `Routine`, `RoutineExercise` (exerciseId + targetSets/reps/restSeconds/weight?), `WorkoutCategory`
- `src/frontend/apps/workout/starters.ts` — 5–6 hand-curated starter routines as exported constants
- `src/frontend/apps/workout/RoutineList.tsx` — list of user + starter routines with name, exercise count, "Start" + Edit/Delete
- `src/frontend/apps/workout/RoutineEditor.tsx` — add exercises from the Phase 1 catalog (modal "Pick exercise" reusing `ExerciseCard`), reorder via drag handles (use `@dnd-kit/core` — already in the project from Kanban), edit per-exercise sets/reps/rest/weight
- `src/frontend/apps/workout/index.tsx` — add Tabs at top: **Browse** | **Routines** (Browse is Phase 1; Routines is new)
- Persistence: `snappet:workout:routines` (array of user-created), `snappet:workout:starters-seeded` (boolean — seed starters into the user array only on first run, then user can delete them without re-seeding)

**Depends on**: Phase 1 (types, exercise loading, ExerciseCard)

**Risk**: Low–Medium — routine editor UI is the most CRUD-heavy. Drag-to-reorder via existing dnd-kit code is straightforward.

**Prompt**: `pdd/prompts/features/workout/26-workout-02-routines.md`

---

### Phase 3 — Workout Player (active session)

**Produces**:
- `src/frontend/apps/workout/types.ts` (extended) — `WorkoutSession` (routineId + startedAt + completedAt? + per-set `{actualReps, actualWeight, completedAt}`), `SetLog`
- `src/frontend/apps/workout/WorkoutPlayer.tsx` — full-screen session view:
  - Current exercise: big image, name, instructions collapsible
  - Set N of M with inputs for weight (kg, with per-set lb toggle) + reps
  - Big "Complete set" button (thumb-target)
  - On set complete: rest timer (countdown from `restSeconds`), vibration + screen flash + Web Audio beep at end
  - "Skip exercise", "End workout early" controls
  - Wake Lock via `navigator.wakeLock.request('screen')` while session active (gracefully no-op on unsupported browsers)
- `src/frontend/apps/workout/RestTimer.tsx` — sub-component handling the countdown + cues
- `src/frontend/apps/workout/index.tsx` — clicking "Start" on a routine routes to player view (internal app routing; not a top-level path change — same `/workout` URL with internal state)
- Persistence: `snappet:workout:active-session` (current in-progress session — survives refresh); on completion, archive to `snappet:workout:history`

**Depends on**: Phase 2 (routine schema, routine list)

**Risk**: Medium-High —
- Wake Lock + audio + vibration combination on iOS has constraints (audio context needs user gesture). The "Start workout" button is the gesture; we initialize the AudioContext there.
- Drift-free timing same pattern as Pomodoro/Stopwatch (Date.now-based, never decrement a counter).
- Mid-session refresh recovery — must restore the active session correctly.

**Prompt**: `pdd/prompts/features/workout/27-workout-03-player.md`

---

### Phase 4 — History + Progress

**Produces**:
- `src/frontend/apps/workout/HistoryList.tsx` — chronological list of completed sessions: date, routine name, duration, total volume (sum of weight × reps across all completed sets)
- `src/frontend/apps/workout/SessionDetail.tsx` — drill-down: per-exercise set-by-set breakdown
- `src/frontend/apps/workout/ExerciseProgress.tsx` — for a given exercise, a tiny bar/line chart (inline SVG, no chart lib) of the top set's weight × reps over the last 10 sessions
- `src/frontend/apps/workout/index.tsx` — add **History** tab (so 3 tabs total: Browse / Routines / History)
- Export button: download `snappet:workout:history` as JSON

**Depends on**: Phase 3 (writes `snappet:workout:history`)

**Risk**: Low — read-only views over persisted data. Inline SVG chart avoids adding a chart library.

**Prompt**: `pdd/prompts/features/workout/28-workout-04-history.md`

---

## Risks & Unknowns

- **PWA bundle impact** — the 1 MB JSON gets precached by vite-plugin-pwa as part of `public/`. Acceptable but pushes the precache from current ~2.4 MB toward ~3.5 MB. If too large, lazy-load via `fetch(import.meta.env.BASE_URL + 'exercises.json')` instead of static `import` — keeps it out of the precache manifest. Default in Phase 1: lazy-fetch.
- **Image CDN reliability** — jsdelivr is well-mirrored but if it goes down, all exercise images break. Fallback to GitHub raw URL on jsdelivr error. Phase 1 prompt should call this out.
- **iOS audio + Wake Lock** — both need user gesture; trigger on "Start workout". Phase 3 risk.
- **Free Exercise DB licensing** — README says "free to use" but doesn't ship a LICENSE file. Visible attribution in the app is our covering action.
- **list virtualization at 800 rows** — measure first; if it scrolls smoothly without virtualization (post-filter, most users see <50 rows), skip the dep. Phase 1 should default to non-virtualized + flag if perf is bad.

## Decisions Needed

None pending — research locked the four user-decided answers (full catalog, kg default, vibration+visual+audio cue, full 4-phase chain).

## Why 4 phases not 3 or 5?

- **Why not 1 mega-prompt?** Per research — too large (2,500+ LoC) for a single PR pass; AI implementation would cut corners.
- **Why not split Phase 1 further?** Catalog + detail view share so much state (loaded data, filter context) that splitting them just multiplies plumbing without testable sub-artifacts.
- **Why not merge Phase 4 into Phase 3?** Phase 3 alone is a usable workout app; Phase 4 is a clear "memory" feature with its own UI surface. Keeping them separate gives a clean shipping decision point — if Phase 3 takes longer than expected, Phase 4 can defer.

---

## Phase 5 — Round-one feedback (added 2026-05-28)

Round-one user feedback (issue #38) flagged five usability issues. Research at `pdd/context/research/workout-app-feedback.md`. Split into three small PRs.

User-confirmed decisions:
- Essentials list size: **100** exercises
- Settings surface: **fourth top-level tab** ("Settings", next to History)
- Migration of existing routines for `defaults`: **auto-derive from most common values** on first read

### Phase 5a — Quick wins

**Produces**:
- `src/frontend/apps/workout/search.ts` — token-and-stem matcher (`buildSearchBag`, `matchesQuery`); used by Browser + Picker
- `src/frontend/apps/workout/ExerciseBrowser.tsx`, `ExercisePicker.tsx` — replace `name.includes(term)` with the new matcher; also search muscles/equipment/category
- `src/frontend/apps/workout/types.ts` — `RoutineExercise.displayName?: string`
- `src/frontend/apps/workout/RoutineEditor.tsx` — ✏ rename modal per row; reset-to-original; passes through to display
- `src/frontend/apps/workout/utils.ts` — `getDisplayName(routineExercise, exercise)` helper
- `src/frontend/apps/workout/WorkoutPlayer.tsx`, `RoutineList.tsx`, `HistoryView.tsx`, `SessionDetail.tsx` — use `getDisplayName`
- `src/frontend/apps/workout/index.tsx` — new **Settings** tab (4th)
- `src/frontend/apps/workout/SettingsView.tsx` — preferred-unit toggle; reads/writes `snappet:workout:preferred-unit`
- `WorkoutPlayer` — read preferred-unit on session start + write it on every user toggle

**Depends on**: Phases 1–4 (already shipped)

**Risk**: Low — additive schema, no migration needed for 5a's changes.

**Prompt**: `pdd/prompts/features/workout/29-workout-05a-quick-wins.md`

### Phase 5b — Routine defaults

**Produces**:
- `src/frontend/apps/workout/types.ts` — `Routine.defaults?: { sets?, reps?, restSeconds?, weightUnit? }`
- `src/frontend/apps/workout/utils.ts` — `deriveDefaults(routine)` (median sets, mode reps, median rest, mode unit)
- `src/frontend/apps/workout/RoutineEditor.tsx` — Defaults block above the row list; new exercises inherit; ⇪ apply-to-all icon on per-row sets/reps/rest fields
- Migration: on RoutineEditor mount, if a routine has `defaults === undefined` AND has ≥1 exercise, compute via `deriveDefaults` and pre-populate (display only; persisted on next Save)

**Depends on**: Phase 5a (clean baseline; not strictly required but stack PRs).

**Risk**: Low–Medium — additive schema, but the auto-derive read path must be deterministic and not surprise users.

**Prompt**: `pdd/prompts/features/workout/30-workout-05b-routine-defaults.md`

### Phase 5c — Progress in ExerciseDetail + Essentials view

**Produces**:
- `src/frontend/apps/workout/essentials.ts` — curated list of **100** exercise IDs (constant; covers all major muscle × equipment combos)
- `src/frontend/apps/workout/ExerciseBrowser.tsx` — Essentials/All toggle; persisted to `snappet:workout:essentials-only` (default `true`)
- `src/frontend/apps/workout/ExerciseDetail.tsx` — new Progress section: three stat cards (top set, total volume, session count) + reuse `ExerciseProgress`; PR marker on highest top-set
- `src/frontend/apps/workout/ExerciseProgress.tsx` — extend with PR star marker; accept `history` prop directly so it works outside SessionDetail
- `src/frontend/apps/workout/index.tsx` — pass `history` down to Browser → Detail

**Depends on**: Phases 5a, 5b.

**Risk**: Low — read-only views and curated data; ExerciseProgress is already proven.

**Prompt**: `pdd/prompts/features/workout/31-workout-05c-progress-essentials.md`

---

## Status

All four original phases shipped:
- Phase 1 — PR #30 (`25-workout-01-browser.md`)
- Phase 2 — PR #31 (`26-workout-02-routines.md`)
- Phase 3 — PR #32 (`27-workout-03-player.md`)
- Phase 4 — PR #33 (`28-workout-04-history.md`)

Phase 5 in progress (issue #38):
- Phase 5a — PR #39 (`29-workout-05a-quick-wins.md`)
- Phase 5b — in progress (`30-workout-05b-routine-defaults.md`)
- Phase 5c — not started

## Next step

After Phase 5 ships, possible follow-ups (each its own future PR if requested):
- Auto-scroll-on-edge during long workouts
- Clear-all-history destructive action (with confirm)
- Body weight tracking + chart
- Cardio-specific session type (distance/time instead of sets/reps)
- Import JSON to restore from export
