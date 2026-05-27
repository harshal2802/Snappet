# Research: Workout app for Snappet

**Date**: 2026-05-27
**Outcome**: **Adopt** Free Exercise DB as the exercise data source (bundled JSON + lazy-loaded images from GitHub raw). **Build** the app itself as a 4-phase prompt chain — Browser → Routine Builder → Workout Player → History. Out-of-the-box routines ship inline as seed data.

## Problem

Users want a place to:
1. Browse a catalog of exercises with photos + how-to instructions
2. Build a routine from selected exercises (sets / reps / rest)
3. Run that routine in the gym/at home with rest timer + set-by-set logging
4. Look back at what they did and when

…all in-browser, offline-capable, no account, no backend — Snappet's standard constraints. This is the largest single mini-app in the project so far; planning it carefully matters.

## Constraints

- **No backend.** All data (routines, sessions) in `localStorage` via the shared `useLocalStorage` hook.
- **Static asset budget.** PWA precache shouldn't bloat by more than ~1.5 MB. Exercise *images* (~60 MB across all 800 exercises) cannot be bundled; must lazy-load from a hosted source and rely on browser HTTP cache.
- **Mobile-first.** This app's primary use is on a phone at the gym/in living room — big tap targets, sleep prevention during a session, vibrate on rest end, single-thumb operation.
- **Attribution.** Whatever data source we use, credit them visibly.
- **No new server-side dependencies.** Free-tier API keys are acceptable if absolutely needed but ideally avoided.

## Existing solutions scanned

### Codebase
No workout app exists. Pomodoro Timer (already shipped) is the closest tangentially related — both are time-based mobile sessions, but the data + interaction models are completely different. No code reuse from there beyond the drift-free timer pattern (which the new Stopwatch app also uses).

### Exercise data sources evaluated

#### A. Free Exercise DB — **recommended**

**What**: Public GitHub repo `yuhonas/free-exercise-db`. A single `dist/exercises.json` (~1 MB / 1,001,472 bytes uncompressed; ~250 KB gzipped) with ~800 exercises. Per exercise:
```json
{
  "id": "3_4_Sit-Up",
  "name": "3/4 Sit-Up",
  "force": "pull",                      // pull | push | static | null
  "level": "beginner",                  // beginner | intermediate | expert
  "mechanic": "compound",               // compound | isolation | null
  "equipment": "body only",             // body only | dumbbell | barbell | …
  "primaryMuscles": ["abdominals"],     // muscle slugs
  "secondaryMuscles": [],
  "instructions": ["…", "…"],           // ordered steps as strings
  "category": "strength",               // strength | cardio | stretching | …
  "images": ["3_4_Sit-Up/0.jpg", "3_4_Sit-Up/1.jpg"]  // start + end frame
}
```

Image URLs: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{path}` — verified 200 OK; ~38 KB each. (Or `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/{path}` for jsdelivr CDN — better latency, identical content.)

**Pros**:
- One file, no API, no rate limits, no keys
- Bundle JSON at build (negligible after gzip)
- Images load from CDN only when a user actually views that exercise
- 800 exercises across all major equipment + body parts; covers everything an everyday user wants
- Two photo frames per exercise (start + end) reads as a mini "GIF" without an actual animation

**Cons**:
- No formal license file in the repo; the README says "Free to use" but the data is derived from older sources (ExRx.net heritage). Best to credit the project prominently in-app.
- English only.
- Images are static photos, not video.

**Effort to integrate**: Low. Copy `exercises.json` into `public/`, type the shape in `types.ts`, lazy-import on app mount.

#### B. wger (https://wger.de) — strong runner-up

**What**: Open-source workout manager (AGPL) with a public REST API. Endpoints under `https://wger.de/api/v2/exerciseinfo/`. Returns paginated JSON with multilingual translations, muscle diagrams, equipment, and contributor-uploaded images. Data licensed CC-BY-SA 4.0.

**Pros**:
- Active project with explicit licensing
- Multilingual (translations of names + descriptions in DE, FR, ES, …)
- Has a proper muscle-group taxonomy with anatomical diagrams

**Cons**:
- Requires runtime fetch per session (no offline catalog without our own caching layer)
- Pagination + multiple endpoints to join (exercises, images, muscles) — more code
- Public instance has unpublished rate limits; for a popular PWA we'd need to self-host or use jsdelivr's mirror of cached data (doesn't exist)
- CC-BY-SA requires the same license on derivative work, which conflicts with Snappet's existing per-PR license model (none stated, but de-facto MIT-style for code; data layer would inherit BY-SA)

**Effort**: Medium — need API client, pagination handler, error states, offline cache.

#### C. ExerciseDB on RapidAPI — rejected

**What**: ~1,300 exercises with animated GIFs.

**Pros**: Best images (GIFs > frames); polished metadata.

**Cons**: **Paid** after the free tier (50 req/day); requires an API key in client code (visible to anyone); proprietary terms forbid bundling. Disqualifies it for Snappet's no-key-no-backend ethos.

**Effort**: would be Low to integrate but fails the constraint test.

#### D. Wikimedia Commons + ad-hoc scraping — rejected

Too much manual curation, no consistent metadata schema, image rights vary per item.

### Routines (seed data)

No need for an external source — we'll ship 4–6 hand-curated starter routines as a TypeScript constant. Examples:
- **Beginner Full Body** (Squat, Push-up, Bent-over Row, Plank, Glute Bridge)
- **Upper Body Push** (Push-up, Overhead Press, Tricep Dip, Lateral Raise)
- **Upper Body Pull** (Pull-up or Inverted Row, Bicep Curl, Face Pull)
- **Lower Body** (Squat, Lunge, Romanian Deadlift, Calf Raise)
- **Core** (Plank, Russian Twist, Dead Bug, Hollow Hold)
- **5-Minute Mobility** (a few stretches by `category: stretching`)

Each routine: ordered list of exercise IDs, default sets/reps/rest.

## Options for app scope

### Single big prompt (Build) — rejected

One prompt covering exercise browser + routine builder + workout player + history. Likely 2,500+ lines of code. Too large for a single PR review pass; AI implementation would likely cut corners.

### **Prompt chain — recommended**

Four phases, each one PR, each independently usable:

**Phase 1: Exercise Browser (read-only catalog)**
- Bundle `exercises.json` in `public/`; load via `fetch` on mount
- Search by name; filter by category / muscle / equipment / level
- Click an exercise → detail view with photos (lazy `<img>` from jsdelivr CDN), instructions, muscles, equipment
- Attribution footer linking to Free Exercise DB

**Phase 2: Routine Builder**
- "Routines" tab; list user routines + 5–6 starter routines (seeded if storage empty)
- New routine: pick exercises from the catalog (re-using Phase 1's data), set sets/reps/rest per exercise, reorder, save
- Edit / duplicate / delete routines
- All persisted under `snappet:workout:routines` and `snappet:workout:starter-seeded` flag

**Phase 3: Workout Player (active session)**
- "Start" a routine → enter session view
- One exercise at a time, big photo + instructions visible
- "Set N of M" with weight (kg/lb toggle) and reps inputs; checkmark to complete a set
- Rest timer auto-starts when set completes; vibrate + audio chime on end
- Sleep prevention via `wakeLock` API where supported
- Persist session in progress under `snappet:workout:active-session` so refresh/lock screen doesn't lose it
- On completion: save the full session record under `snappet:workout:history`

**Phase 4: History (optional v2 if Phase 3 feels enough)**
- List of past workouts (date, routine name, duration, volume)
- Tap into one for set-by-set breakdown
- Per-exercise progress: simple bar chart of last 10 sessions' top set
- Export history as JSON

Each phase has a clear "done" gate: Phase 1 alone is a useful exercise reference; Phase 2 alone is a usable routine planner; Phase 3 turns it into a real workout app; Phase 4 adds memory.

## Recommendation

**Adopt Free Exercise DB + Build a 4-phase prompt chain.**

Concretely:
1. Save this research → done
2. `/pdd-plan` for the full chain
3. `/pdd-prompts` for Phase 1 (`25-workout-01-browser.md` — continuing the project's numeric sequence)
4. Implement → review → PR → merge
5. Repeat steps 3–4 for Phases 2, 3, 4

Effort estimate: each phase ~½–1 day of focused work. Whole chain ~3–4 PRs over several sessions. Largest single feature in Snappet so far; the chain decomposition keeps each PR within review-able size (~500–800 LoC).

## Rejected alternatives (logged)

- **wger API**: license + offline + complexity tradeoffs above
- **ExerciseDB / RapidAPI**: paid + API-key
- **Single mega-prompt**: too large for one PR review pass
- **Auto-curating images from Wikimedia**: rights + schema mess
- **Backend (DB + sync)**: violates Snappet's no-backend ethos

## Open questions for the user

1. **Scope through Phase 3 or 4?** Phase 3 makes it a real workout app; Phase 4 adds history+charts. Worth doing both but the user can defer 4 if they want to ship sooner.
2. **Exercise data — full 800 or curated subset?** Full set is ~1 MB JSON, no real downside. Curated 100 would feel less overwhelming but limits long-tail. Default: full 800 with good search/filter UX so it doesn't feel overwhelming.
3. **kg or lb default?** Toggle either way, but pick a default. Lean kg as the global default (matches `vibrate`, `°C` defaults in other apps).
4. **Rest timer audio cue?** Web Audio short beep at end? Or just vibration + visual? Vibration + visual is simpler and works in PWA standalone on iOS 16.4+.

## Next step

`/pdd-plan` to formalize the 4-phase chain. Once the user picks answers to the open questions, the plan locks them in.
