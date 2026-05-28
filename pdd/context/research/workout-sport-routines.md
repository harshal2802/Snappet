# Research: Sport-tagged routines (climbing, calisthenics) with search & filter

**Date**: 2026-05-27
**Outcome**: Build — extend `Routine` with `sport / level / tags / description / source`, ship 9 new routines (4 climbing + 5 calisthenics) alongside the existing 6 generic starters, add a routine-search + filter UI. Migrate existing seed on next load by adding only missing-id routines (no destructive re-seed).

## Problem

Snappet's workout app currently has **6 generic starter routines** seeded once. Users coming in with a specific goal — train for climbing, train calisthenics, train for X sport — have no scaffolding. They have to manually build everything from the exercise catalog.

We want:
1. A library of curated routines organized by sport
2. Multiple routines per sport (different muscle groups / focuses)
3. Search and filter so users find the right routine quickly
4. Extensibility — adding more sports later (running, yoga, powerlifting) should be a data change, not a refactor

## Constraints

- **No new dependencies.** Snappet ethos — all data client-side.
- **Exercise IDs must exist in `public/exercises.json`** (Free Exercise DB). Climbing-specific tools like hangboards, campus boards, and pure L-Sit are NOT in the dataset. We work around this with what's available (Pullups, Hanging Pike, Scapular Pull-Up, Inverted Row, Finger Curls for forearm work, etc.).
- **Don't break user data.** Users may have edited/deleted the existing 6 starters. The new routines must seed alongside without re-seeding the deleted ones.
- **Don't make routine creation harder.** Sport/level/tags are *optional* fields — user-created routines without them still work; we just won't filter them when filters are active.
- **Visible source attribution.** Fitness routines are pulled from published protocols — credit the source (Lattice Training, Reddit r/bodyweightfitness Recommended Routine, GMB, Eric Hörst's books).

## Existing solutions scanned

### Codebase
- `pdd/prompts/features/workout/PLAN-workout-app.md` is complete (Phases 1–4 shipped). The architecture supports extension here without restructuring.
- Current `Routine` shape: `{ id, name, exercises, createdAt, updatedAt, isStarter? }`. We extend it.
- Seeding is one-shot via `snappet:workout:starters-seeded` boolean. Needs evolution to handle additive seeding.

### Routine sources (external, for content)
- **Climbing**: Eric Hörst's *Training for Climbing*, Steve Bechtel's *Logical Progression*, Lattice Training blog. Common motifs: max pull strength, antagonist + forearm balance, power endurance, climber-specific core. **Hangboard protocols intentionally omitted** — the exercises don't exist in our dataset, and proper hangboarding needs equipment + form coaching we can't replicate in a list-of-exercises format.
- **Calisthenics**: Reddit r/bodyweightfitness *Recommended Routine* (CC-BY-SA, well-known beginner template), GMB Elements / Foundations, Convict Conditioning progressions, /r/bodyweightfitness *Move* series. Motifs: starting strength (RR-style), push, pull, single-leg / lower, skill + conditioning.

### Exercise ID coverage check (already in `public/exercises.json`)

**Climbing (all verified)**: `Pullups`, `Chin-Up`, `One_Arm_Chin-Up`, `Scapular_Pull-Up`, `Inverted_Row`, `Hanging_Leg_Raise`, `Hanging_Pike`, `Bench_Dips`, `Pushups`, `Handstand_Push-Ups`, `Finger_Curls`, `Farmers_Walk`, `Plank`, `Side_Bridge`, `Russian_Twist`, `Dead_Bug`, `Mountain_Climbers`, `Worlds_Greatest_Stretch`, `Kneeling_Forearm_Stretch`, `Childs_Pose`, `Spinal_Stretch`, `Bent_Over_Two-Dumbbell_Row`.

**Calisthenics (all verified)**: same plus `Bodyweight_Squat`, `Decline_Push-Up`, `Close-Grip_Push-Up_off_of_a_Dumbbell`, `Kettlebell_Pistol_Squat`, `Dumbbell_Lunges`, `Single_Leg_Glute_Bridge`, `Standing_Calf_Raises`, `Glute_Ham_Raise`, `Romanian_Deadlift`, `Band_Assisted_Pull-Up`.

**Notable gaps** (no good substitute in dataset):
- No hangboard / fingerboard exercises
- No L-Sit (use `Hanging_Pike` as close-enough)
- No pure bodyweight `Pistol_Squat` (only `Kettlebell_Pistol_Squat` — counts as bodyweight if user goes empty-handed)
- No Hollow Hold (use `Dead_Bug`)

## Options evaluated

### Option 1 — Extend Routine schema + filter UI (**recommended**)

**What**: Add optional metadata to `Routine` — `sport?`, `level?`, `tags?`, `description?`, `source?`. Add `routine-filters` state in RoutinesView (sport/level chips + search input). Ship 9 new starter routines alongside existing 6. Additive seeding (add only missing ids).

**Pros**:
- Minimal schema change — all new fields optional, no migration risk for existing routines
- Search/filter reuses the same pattern as the Browse tab (segmented chips + count badge)
- Extensible to more sports without code changes — just data
- Source attribution lives on the routine for credibility

**Cons**:
- ~600–800 LoC across schema, starters, filter UI, and tests
- Additive seeding adds a small amount of code complexity (vs. one-shot flag)

**Effort**: Medium

### Option 2 — Separate "Library" tab from "Routines" tab

**What**: Keep user-created routines in the existing Routines tab; add a separate Library tab full of read-only sport-tagged starter routines. User can "Duplicate to my routines" to customize.

**Pros**: Clean separation — Library is curated/immutable; Routines is user's.

**Cons**: Adds a 4th tab to the workout app (Browse / Routines / Library / History) — getting cluttered. Forces an extra Duplicate step before any customization. Diverges from the established "seed once + user can edit" pattern.

**Effort**: Medium-High

### Option 3 — External-API routine fetch

**What**: Fetch sport routines from an external source on demand (no permanent storage).

**Pros**: Always fresh, no maintenance.

**Cons**: Violates Snappet's no-backend / no-dependency ethos. No good open-source API exists for routine prescriptions. Rejected.

**Effort**: Medium (but pointless given the constraint).

## Recommendation

**Option 1.** It fits the established pattern (one tab, all routines together, filters like Browse), is fully optional for user-created routines, and ships content + UI in one cohesive change.

## Proposed schema delta

```ts
// types.ts (additive)

export type SportTag =
  | 'general'           // existing starters + user routines without a sport
  | 'climbing'
  | 'calisthenics'
  // future: 'running' | 'cycling' | 'yoga' | 'powerlifting' | ...

export type RoutineLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Routine {
  // … existing fields …
  sport?: SportTag
  level?: RoutineLevel
  tags?: string[]            // free-form, e.g. ['grip', 'antagonist', 'skill']
  description?: string       // 1–2 sentences shown in card + detail
  source?: { label: string; url?: string } // credibility — shown as a small footnote
}
```

Existing routines without these fields still render (UI treats `sport ?? 'general'` etc.).

## Proposed routine library (15 total — 6 existing + 9 new)

Existing (untouched): Beginner Full Body, Upper Body Push, Upper Body Pull, Lower Body, Core Crusher, 5-Minute Mobility. All become `sport: 'general'` on migration.

### New — Climbing (4)

| Name | Level | ~Min | Equipment | Source |
|---|---|---|---|---|
| Climbing — Max Pulling Strength | intermediate | 40 | Pull-up bar | Hörst, *Training for Climbing* |
| Climbing — Antagonist & Recovery | all | 30 | Body only | Lattice Training blog |
| Climbing — Power Endurance | intermediate | 35 | Pull-up bar | Bechtel, *Logical Progression* |
| Climbing — Core for Climbers | all | 20 | Pull-up bar | general climbing canon |

### New — Calisthenics (5)

| Name | Level | ~Min | Equipment | Source |
|---|---|---|---|---|
| Calisthenics — Starting Strength (RR-style) | beginner | 40 | Pull-up bar | r/bodyweightfitness Recommended Routine (CC-BY-SA) |
| Calisthenics — Push Strength | intermediate | 35 | Parallettes / dip station | GMB Elements |
| Calisthenics — Pull Strength | intermediate | 35 | Pull-up bar | r/bodyweightfitness Move |
| Calisthenics — Single-Leg & Lower | intermediate | 30 | Body only | Convict Conditioning progressions |
| Calisthenics — Skill & Conditioning | advanced | 30 | Parallettes + bar | GMB Foundations |

Full per-routine exercise lists with verified IDs, sets/reps/rest defaults are written below — they go straight into `starters.ts` once the implementer wires the schema:

<details>
<summary>Full routine specs (15 routines, all exerciseIds verified)</summary>

#### Climbing — Max Pulling Strength
```
sport: 'climbing', level: 'intermediate', tags: ['pull', 'strength']
Scapular_Pull-Up: 3 × 5, 60s rest
Pullups: 5 × 5, 180s rest
Chin-Up: 4 × 6, 120s rest
Inverted_Row: 3 × 8, 90s rest
Hanging_Leg_Raise: 3 × 8, 60s rest
```

#### Climbing — Antagonist & Recovery
```
sport: 'climbing', level: 'beginner', tags: ['antagonist', 'mobility', 'recovery']
Pushups: 3 × 12, 60s
Bench_Dips: 3 × 10, 60s
Handstand_Push-Ups: 3 × 5, 90s    # advanced; degrade to Incline_Push-Up if needed
Finger_Curls: 3 × 15, 45s          # forearm extensor balance
Kneeling_Forearm_Stretch: 1 × 60s each side, 0s
Worlds_Greatest_Stretch: 1 × 30s each side, 0s
Childs_Pose: 1 × 60s, 0s
```

#### Climbing — Power Endurance
```
sport: 'climbing', level: 'intermediate', tags: ['endurance', 'pull']
Pullups: 3 × 'max-2', 180s          # leave 2 reps in tank
Bent_Over_Two-Dumbbell_Row: 3 × 10, 90s
Hanging_Pike: 3 × 8, 60s
Mountain_Climbers: 3 × 30s, 30s
Plank: 3 × 60s, 45s
```

#### Climbing — Core for Climbers
```
sport: 'climbing', level: 'all', tags: ['core']
Hanging_Leg_Raise: 3 × 8, 60s
Hanging_Pike: 3 × 8, 60s
Plank: 3 × 45s, 30s
Side_Bridge: 3 × 30s each side, 30s
Russian_Twist: 3 × 20, 30s
Dead_Bug: 3 × 10 each side, 30s
```

#### Calisthenics — Starting Strength (RR-style)
```
sport: 'calisthenics', level: 'beginner', tags: ['full-body', 'strength']
Bodyweight_Squat: 3 × 12, 90s
Pushups: 3 × 8, 90s
Inverted_Row: 3 × 8, 90s
Glute_Ham_Raise: 3 × 5, 90s
Plank: 3 × 30s, 30s
Hanging_Leg_Raise: 3 × 6, 60s
```

#### Calisthenics — Push Strength
```
sport: 'calisthenics', level: 'intermediate', tags: ['push', 'strength']
Pushups: 4 × '8-12', 90s
Decline_Push-Up: 4 × 8, 120s
Close-Grip_Push-Up_off_of_a_Dumbbell: 3 × 8, 90s
Bench_Dips: 3 × 10, 60s
Handstand_Push-Ups: 3 × '3-5', 120s
```

#### Calisthenics — Pull Strength
```
sport: 'calisthenics', level: 'intermediate', tags: ['pull', 'strength']
Scapular_Pull-Up: 3 × 5, 60s
Pullups: 5 × 5, 180s                 # Band_Assisted_Pull-Up alt
Chin-Up: 4 × 6, 120s
Inverted_Row: 3 × 8, 90s
Hanging_Leg_Raise: 3 × 8, 60s
```

#### Calisthenics — Single-Leg & Lower
```
sport: 'calisthenics', level: 'intermediate', tags: ['legs', 'unilateral']
Bodyweight_Squat: 3 × 15, 60s        # warm-up volume
Kettlebell_Pistol_Squat: 4 × 5 each leg, 90s
Dumbbell_Lunges: 3 × 10 each leg, 60s
Single_Leg_Glute_Bridge: 3 × 10 each side, 45s
Standing_Calf_Raises: 3 × 15, 30s
```

#### Calisthenics — Skill & Conditioning
```
sport: 'calisthenics', level: 'advanced', tags: ['skill', 'conditioning']
Handstand_Push-Ups: 4 × 3, 120s
One_Arm_Chin-Up: 3 × 3 each arm, 180s   # negatives-only for most
Hanging_Pike: 3 × 8, 90s
Pushups: 3 × 'max', 60s
Mountain_Climbers: 3 × 30s, 30s
```

</details>

## Proposed UI delta (Routines tab)

Above the routine list (sticky, like Browse tab):
- Search input (filters by routine name + description, case-insensitive)
- "Filters" toggle that reveals:
  - **Sport** chip row: All / General / Climbing / Calisthenics (one selected at a time)
  - **Level** chip row: All / Beginner / Intermediate / Advanced (one)
- Active filter count badge on Filters button (same pattern as Browse)
- Filters persisted under `snappet:workout:routine-filters`

Card rendering changes:
- Show small sport badge next to name (color per sport — climbing rose, calisthenics indigo, etc.)
- Show level pill (existing pattern from ExerciseCard's level pill)
- Description below name (if present)
- Source citation as a tiny footer ("Source: r/bodyweightfitness Recommended Routine")

Empty state when filters match nothing: "No routines match. Try clearing filters or adding your own."

## Seeding evolution (no destructive re-seed)

Replace the boolean `snappet:workout:starters-seeded` with a smarter approach:

```ts
// On mount, in the orchestrator:
useEffect(() => {
  setRoutines((prev) => {
    const have = new Set(prev.map((r) => r.id))
    const missing = STARTER_ROUTINES.filter((s) => !have.has(s.id))
    if (missing.length === 0) return prev
    return [...missing, ...prev]
  })
  // No flag needed — by-id presence is the source of truth.
}, [])
```

User-deleted starters stay deleted (their id is no longer in `STARTER_ROUTINES`-but-was deleted means it's NOT in `have` → would get re-seeded → wrong!).

Better: track which starter IDs the user has *ever* dismissed, persisted as `snappet:workout:starters-dismissed: string[]`. On seed: skip ids in this set. When user deletes a starter, add its id to the dismissed set.

```ts
const [dismissed, setDismissed] = useLocalStorage<string[]>('snappet:workout:starters-dismissed', [])

useEffect(() => {
  const have = new Set(routines.map((r) => r.id))
  const dismissedSet = new Set(dismissed)
  const missing = STARTER_ROUTINES.filter((s) => !have.has(s.id) && !dismissedSet.has(s.id))
  if (missing.length > 0) setRoutines((prev) => [...missing, ...prev])
}, [])

// When user deletes:
function handleDeleteRoutine(id: string) {
  const r = routines.find((x) => x.id === id)
  setRoutines(...)
  if (r?.isStarter) setDismissed((d) => [...new Set([...d, id])])
}
```

Migration path: existing users with `starters-seeded: true` flag — their 6 v1 starters are already there (or they deleted some). On next load: their non-dismissed v1 starters stay; the 9 new sport-tagged routines get added (their ids aren't in `have` or `dismissed`). The old boolean flag becomes a no-op; can be removed in a follow-up cleanup.

## Custom routines with full metadata

**Update (2026-05-28)**: the Routine Editor will expose the same metadata fields the starters use (description, sport, level, tags, source) under an "Advanced metadata" disclosure (closed by default). This is the path for niche / sport-specific protocols the curated library doesn't cover — hangboard / fingerboard / yoga flows / sport-specific conditioning. Users compose them with the metadata; the curated library only ships the ones whose underlying exercises exist in the bundled dataset.

## Out of scope

- ~~Hangboard / fingerboard protocols~~ — now handled by the editor; users build their own and tag them as `climbing`. We just don't ship a curated one because the dataset doesn't have the underlying exercises.
- Routine versioning (v1 of a starter being updated to v2 — not yet a real problem)
- Sharing routines (no backend)
- Sport icons (emoji is enough for v1)
- Routine ratings or community routines

## Next step

User reviews this and either (a) greenlights — then we'd `/pdd-plan` → `/pdd-prompts` for implementation, or (b) revises the scope. **Output of THIS step**: a GitHub issue in the snappet repo summarizing scope so the work has a tracked unit.
