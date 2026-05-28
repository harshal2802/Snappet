# Research: Workout app — round-one user feedback

**Date**: 2026-05-28
**Outcome**: **Build** five targeted improvements grouped into one prompt chain (Phase 5). All are extensions to existing components; no new data source needed. Recommend a single research-backed GitHub issue, then split implementation into 2–3 small PRs along the existing phase numbering convention (`29-workout-05-…`).

## Problem

After shipping Phases 1–4 (Browser → Routine Builder → Player → History), the first-pass user gave focused feedback. None of it questions the app's core direction; all five points are concrete usability issues. Untreated, they each cost real time during a workout session:

1. **Search misses near-matches** — typing `inclined bench press` returns zero, but `bench press` shows the variation.
2. **Catalog overload** — bench press alone has ~10 variations; the picker feels noisy when building a routine.
3. **Rest time doesn't propagate** — changing rest on one exercise leaves the other rows untouched; tedious for full-routine edits.
4. **Weight unit isn't sticky** — the kg/lb toggle is per-set, not per-user. Switching to lb in one exercise doesn't persist to the next.
5. **No per-exercise progress view** — `ExerciseProgress.tsx` exists but is buried in `SessionDetail`. There's no "show me my Bench Press history" entry point.

## Constraints (carried from the original research)

- No backend; all state in `localStorage` via `useLocalStorage`.
- PWA precache budget — avoid adding heavy deps.
- Mobile-first; one-thumb operation; minimum tap target ~44 px.
- Must not break existing data: routines, sessions, history are all already in users' `localStorage`.

## Where each feedback hits the code

| # | File(s) | Symbol / line |
|---|---|---|
| 1 | `ExerciseBrowser.tsx`, `ExercisePicker.tsx` | `ex.name.toLowerCase().includes(term)` (Browser:192, Picker:96) |
| 2 | `data.ts` + `ExerciseBrowser.tsx` | The full 800-row catalog is shown unfiltered by default |
| 3 | `RoutineEditor.tsx` | Each row owns `restSeconds`; default 60 hard-coded (`handlePick`, line 47) |
| 4 | `WorkoutPlayer.tsx` | `unitInput` is reseeded from `targetWeightUnit ?? 'kg'` on exercise change (line 156, 164). No user-level preference key. |
| 5 | `ExerciseProgress.tsx` | Rendered only inside `SessionDetail`; no top-level entry point from Browser/History |

## Verified facts from the data

- The Free Exercise DB uses `Incline` (142 hits), never `Inclined` (0 hits). Substring search of `"inclined"` is guaranteed to miss every relevant row.
- The name field is the only searchable text today — muscles, equipment, category, force are filterable only via the pill UI.

## Options evaluated

### Feedback 1 — Better search

| Option | What | Pros | Cons | Effort |
|---|---|---|---|---|
| A. Token-based AND match | Split user query into tokens; every token must appear as a substring in the searchable text | Catches `inclined` if combined with a stemmer; works with current data | Doesn't fix `inclined` → `incline` alone | Low |
| B. Simple stemmer | Strip trailing `s`, `es`, `ed`, `ing`, `d` from both query tokens and indexed tokens | Cheap, no dep, fixes the exact reported case | Imperfect — fine for English exercise names | Low |
| C. Fuse.js fuzzy match | Add `fuse.js` (~7 KB gzipped) for Levenshtein-style scoring | Robust to typos, ranks results | New dep, more bundle bytes, harder to reason about ranking | Medium |
| D. Search across muscles + equipment | Also search secondary fields | Lets users type "biceps" or "kettlebell" and see results | Doesn't fix the stemming issue alone | Low |

**Recommend A + B + D combined**: tokenize the query, stem each token (and pre-stem an indexed bag of words made of `name + primaryMuscles + secondaryMuscles + equipment + category`), and require every query token to match. Together this fixes `inclined`, `kettlebells`, `biceps`, etc. without a new dep. Roughly ~30 lines.

### Feedback 2 — Catalog overload

| Option | What | Pros | Cons | Effort |
|---|---|---|---|---|
| A. Hard-curated "Essentials" subset (~100) as default; toggle to show all | Hand-pick a representative ID list; default to that | Most direct fix to the "too many" feeling | Curation work; needs a maintained list | Medium |
| B. Group variations into one canonical entry with a "Variations" sub-list | Data-level grouping (e.g. all "Bench Press" rows behind one card) | Cleanest UX | Requires building & maintaining a grouping map for 800 exercises | High |
| C. Favorites / starred exercises surface first | Per-user pin list in `localStorage` | Cheap, lets users curate | Doesn't help first-run users | Low |
| D. Rename-in-routine: user can override the displayed name on any routine row | Adds `displayName?: string` to `RoutineExercise`; falls back to catalog name | Solves "let user change the name if needed" from the feedback verbatim | Doesn't reduce browser noise alone | Low |

**Recommend A + C + D**: Ship Essentials-by-default (the curated 100–150 list lives in `essentials.ts`, behind a "Show all 800" toggle). Add a star/favorite for power users (Phase 2 polish). And the in-routine rename is independent, useful, and small — ship it now.

### Feedback 3 — Rest time propagation

| Option | What | Pros | Cons | Effort |
|---|---|---|---|---|
| A. Inline "apply to all" link next to rest field | One-tap "set this on every row" | Minimal UI change | Doesn't solve sets/reps which have the same shape | Low |
| B. Routine-level defaults | New `Routine.defaults?: { sets, reps, restSeconds }`; each row inherits unless overridden | Conceptually correct; new picks inherit current defaults | Migration of existing routines | Medium |
| C. Most-recent-change propagation | If user changes rest on row 1 while other rows still have default, propagate | "Magic" but matches intent | Hard to surface (when is it active? when did it stop?) | Medium |
| D. Bulk edit toolbar | Multi-select rows, edit value, apply | Powerful | Heavyweight UI for a 5–10 row list | High |

**Recommend B + A**: Add `Routine.defaultSets`, `defaultReps`, `defaultRestSeconds`. New exercises inherit them. Show defaults at the top of the editor as their own row ("Defaults applied to new exercises"). On any per-row field, surface a small ⇪ "Apply to all rows" affordance for quick bulk-set on an existing routine. Existing routines without defaults render normally — no migration needed; defaults are optional.

### Feedback 4 — Sticky weight unit

| Option | What | Pros | Cons | Effort |
|---|---|---|---|---|
| A. Global preference: `snappet:workout:preferred-unit` | Single user-level kg/lb; default for all new inputs everywhere | Predictable; one source of truth | If user works in mixed units sometimes, still needs per-row override | Low |
| B. Session-sticky | When user picks lb, every subsequent exercise in the *active session* uses lb | Matches feedback wording closely | Doesn't persist across sessions | Low |
| C. Auto-detect from history | Look at last N sessions, pick the dominant unit | Zero-config | Fragile; first-session users still need a default | Medium |

**Recommend A + B**: Persist `preferredUnit` globally. When a user toggles unit inside a session, update both the in-session state AND the preference. Net effect: change once, sticky everywhere going forward. Surface the setting once in a small "Settings" section near the Routines tab (or under a gear icon on the Browse tab header) so users can flip it without starting a workout.

### Feedback 5 — Per-exercise progress view

| Option | What | Pros | Cons | Effort |
|---|---|---|---|---|
| A. Promote `ExerciseProgress` into `ExerciseDetail` | Show the chart whenever an exercise is opened from Browser | Discoverable; reuses existing component | Only shows once user has done the exercise | Low |
| B. New "Progress" tab | Top-level fourth tab; lists every exercise the user has ever done, with mini-spark + drill-in | Dedicated home for "how am I doing" | More navigation; partially duplicates History | Medium |
| C. Rich exercise stats panel | Top set, total volume, session count, PR markers, est. 1RM | Deep insight | Lots to design; risk of overbuilding | Medium |

**Recommend A + C as one step, defer B**: Put the chart on `ExerciseDetail` (Browse → tap exercise). Expand it from "top set per session" to a richer 3-card view: Top set | Total volume | Session count, plus the existing bar chart with PR markers. Skip a dedicated tab — the History tab already lists everything done; a `?exercise=<id>` deep-link from history into the detail view closes the loop without a new top-level destination.

## Recommendation — phasing

**One umbrella issue, three small PRs.**

- **PR 5a — Quick wins (Feedback 1, 4, partial 2)**: better search, sticky weight unit, in-routine exercise rename. Pure additions; no schema change for routines. ~250 LoC.
- **PR 5b — Routine defaults & propagation (Feedback 3)**: optional `defaults` on `Routine`, "Apply to all" affordance. Backwards-compatible schema. ~200 LoC.
- **PR 5c — Progress in ExerciseDetail + Essentials view (Feedback 5, rest of 2)**: hoist `ExerciseProgress` into detail, expand the stat cards, add curated `essentials.ts` + "Show all" toggle. ~300 LoC.

Each PR is shippable independently; users see incremental wins.

## Rejected alternatives (logged)

- **Fuse.js for search**: small dep, but adds bytes; the stem-and-tokenize approach handles the reported case without the dep.
- **Variation grouping at the data layer**: too much manual curation per exercise; instead we let the curated Essentials list handle the discoverability problem and the in-routine rename handle the naming problem.
- **Dedicated Progress tab**: would split overview between History and Progress; the unified "tap an exercise → see your history with it" pattern is cleaner.
- **Bulk-edit toolbar in RoutineEditor**: overkill for the typical 5–10 row routine — defaults + per-row "apply to all" covers the same need with less UI.

## Open questions for the user

1. **Essentials list size** — 100 or 150 exercises? 100 fits one screen-worth of scrolling per category; 150 covers more long-tail equipment.
2. **Where to surface the global unit preference** — header gear icon, or first-class "Settings" tab? Header gear is lighter; Settings tab gives us room to add more prefs later (rest sound on/off, vibration on/off, theme).
3. **Migration of existing routines** — when the routine defaults model lands, do we auto-derive defaults from the most-common values in the existing exercises? Or leave defaults `undefined` until user sets them? Recommend the latter — predictable, zero risk of changing existing behavior.

## Next step

Create the GitHub issue with detailed proposal + wireframes (current step). Once the user picks answers on the open questions, `/pdd-plan` for the Phase 5 chain.
