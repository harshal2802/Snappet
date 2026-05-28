# Implementation Plan: Sport-tagged routines + search/filter + editor metadata

**Created**: 2026-05-28
**Complexity**: Medium
**Estimated prompts**: 1
**Issue**: #35
**Research**: `pdd/context/research/workout-sport-routines.md` (+ amendment via PR #36)

## Summary

Extend the workout app's routine layer with sport-aware metadata, a searchable/filterable Routines tab, an "Advanced metadata" disclosure in RoutineEditor for custom routines, and 9 new starter routines (4 climbing + 5 calisthenics). Migrate the seed mechanism from a one-shot boolean to a per-id "dismissed" list so existing users get the new starters without re-seeding ones they deleted.

This planning round explicitly anchors against **current `main`** — Phases 5a, 5b, 5c, 6 have shipped (PRs #39, #42, #41, #44, #45) since the original research was written. Nothing in this scope conflicts; everything is additive.

## Current-state baseline (what's already on `main`)

| Surface | What exists | Implication for this plan |
|---|---|---|
| `types.ts` `Routine` | `id, name, exercises, createdAt, updatedAt, isStarter?, defaults?: RoutineDefaults` | Add 5 new optional fields *alongside* `defaults`. Do not modify the existing fields. |
| `types.ts` `RoutineExercise` | `… + displayName?` (Phase 5a) | Untouched. |
| `RoutineEditor.tsx` | Name input + Defaults collapsible (5b) + per-row rename / arrows / × / weight / notes (5a + Phase 2) | Add a *second* sibling collapsible: "Advanced metadata". Sits just below the name input, just above the existing Defaults collapsible. |
| `index.tsx` tabs | `dashboard / browse / routines / history / settings` (5 tabs) | No new tabs. |
| Routines tab UI | RoutineList only — no search, no filters | Add sticky-top search + Filters reveal (Sport / Level chip rows), mirroring the Browse-tab pattern from Phase 1. |
| `starters.ts` | 6 generic routines, no metadata | Add `sport: 'general'` to all 6; append 9 new sport-tagged routines (4 climbing + 5 calisthenics) per research file. |
| Seeding | `snappet:workout:starters-seeded: boolean` (Phase 2) | Migrate to `snappet:workout:starters-dismissed: string[]`. Old boolean becomes a no-op; safe to ignore for now (cleanup future PR). |

## Phases

### Phase 1 — Sport-tagged routines, library expansion, search/filter, editor metadata

**Produces**:
- `src/frontend/apps/workout/types.ts` — add `SportTag`, `RoutineLevel`, `RoutineSource` types; extend `Routine` with `sport? / level? / tags? / description? / source?` (all optional; no migration of existing user data)
- `src/frontend/apps/workout/starters.ts` — 6 existing routines tagged `sport: 'general'`; append 9 new (4 climbing + 5 calisthenics) per the research file's verified exerciseId lists, with `sport / level / tags / description / source` populated
- `src/frontend/apps/workout/RoutineEditor.tsx` — new "Advanced metadata" collapsible (closed by default unless the routine already has any metadata set) with inputs for Description / Sport / Level / Tags (free-text → chips) / Source (label + optional URL). Save persists. Sits as a sibling above the existing Defaults block.
- `src/frontend/apps/workout/RoutineList.tsx` — extra rendering: sport badge (color per sport), level pill (reusing the Phase 1 ExerciseCard pattern), description below name, source citation footer when present
- New `src/frontend/apps/workout/RoutinesView` (extracted from `index.tsx` if not already; otherwise update in-place) — sticky search input + Filters reveal with two single-select chip rows (Sport, Level). Active filter count badge on Filters button (Browse-tab pattern). Filters persisted under `snappet:workout:routine-filters`; search under `snappet:workout:routine-search`. Empty state when filters match nothing.
- `src/frontend/apps/workout/index.tsx` — replace `starters-seeded` seeding effect with `starters-dismissed` logic. On any starter delete, push that id into the dismissed array.

**Depends on**: existing Phases 1–6 (all shipped on main).

**Risk**: Medium.
- Seeding migration is the only place where existing user data interacts with new logic — must NOT re-seed user-deleted starters. The dismissed-list approach makes this safe.
- `RoutineEditor` now has two collapsibles ("Advanced metadata" and existing "Defaults"). Visual collision risk — prompt will be specific about ordering and spacing.
- All other changes are pure additions to optional schema fields; backwards-compatible by construction.

**Prompt**: `pdd/prompts/features/workout/33-workout-sport-routines.md` (continues the existing numeric sequence; last was `32-workout-06-dashboard.md`).

## Risks & Unknowns

- **Seeding migration race**: a user who first opened the app pre-Phase-2 might not have `starters-seeded` set. The new seeding logic must handle both: no flag → seed all + write empty dismissed; `starters-seeded: true` but no dismissed → seed only new (the 9 sport-tagged ones) and not re-seed any v1 starter they may have deleted. Implementation defense: `starters-dismissed` defaults to `[]` and ONLY grows when the user explicitly deletes a starter going forward; for the migration window, accept that a user who deleted a v1 starter pre-this-PR will see it re-appear once. Acceptable — they can delete again, and it stays gone (because next time the dismissed list will include it).
- **Filter UX with mixed routines**: user-created routines without `sport` show up under "General" filter (treat `sport ?? 'general'`). User-created routines without `level` show up under ALL level filters except a level-specific one. Documented in the prompt.
- **Custom routine UX**: the issue calls for first-class custom routine creation with all metadata. The "Advanced metadata" disclosure delivers that. Source-URL validation is light (no protocol validation) — just an `<input type="url">` so mobile keyboards behave; bad URLs render as plain text in the citation footer rather than as a link.

## Decisions Needed

None new. Settled by issue #35 + amendment PR #36 + research file:
- Single PR (not chain) — scope is contained.
- Editor exposes metadata under an "Advanced metadata" disclosure (closed by default).
- Hangboard / fingerboard handled via editor's custom-routine path; not in the curated library.
- Seeding evolves to a dismissed-list approach (no destructive re-seed).
- 9 starter routines source: r/bodyweightfitness RR, GMB, Hörst, Bechtel, Lattice, Convict Conditioning.

## Why one phase

- Schema delta is additive (5 optional fields).
- Content delta (9 routines) is data, not code.
- Editor disclosure is ~60 LoC.
- Filter UI is a copy of Browse-tab's pattern, ~120 LoC.
- Seeding migration is ~20 LoC.

Total estimate ~700–900 LoC; splitting would multiply review surface without isolating risk.

## Next step

`/project:pdd-prompts` to draft `33-workout-sport-routines.md`. Implement → review → PR → merge → close issue #35.
