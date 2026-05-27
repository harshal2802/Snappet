# Prompt: Workout app — Phase 1: Exercise Browser

**File**: pdd/prompts/features/workout/25-workout-01-browser.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Chain**: 1 of 4
**Source**: `pdd/context/research/workout-app.md`
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Depends on**: `pdd/prompts/features/scaffold/01-project-setup.md`

## Context

Snappet is a hub of lightweight single-page web apps. This is Phase 1 of the Workout app at `/workout`: a read-only exercise catalog browser. Subsequent phases add Routine Builder (Phase 2), Workout Player (Phase 3), and History (Phase 4). Phase 1 must be useful on its own — a searchable, filterable exercise reference with photos and step-by-step instructions.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new runtime deps for Phase 1.

**Data source**: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db). Bundle `dist/exercises.json` (~1 MB, 800 exercises) into `public/exercises.json` for offline access; load via `fetch` on mount (not static import — keeps it out of vite-plugin-pwa's precache manifest). Images are NOT bundled — they live on jsdelivr CDN and load lazily per exercise viewed.

## Exercise data shape (from upstream)

```json
{
  "id": "3_4_Sit-Up",
  "name": "3/4 Sit-Up",
  "force": "pull",                       // 'pull' | 'push' | 'static' | null
  "level": "beginner",                   // 'beginner' | 'intermediate' | 'expert'
  "mechanic": "compound",                // 'compound' | 'isolation' | null
  "equipment": "body only",              // see EquipmentSlug union below
  "primaryMuscles": ["abdominals"],      // see Muscle union below
  "secondaryMuscles": [],
  "instructions": ["…step 1…", "…step 2…"],
  "category": "strength",                // 'strength' | 'cardio' | 'stretching' | 'plyometrics' | 'powerlifting' | 'olympic weightlifting' | 'strongman'
  "images": ["3_4_Sit-Up/0.jpg", "3_4_Sit-Up/1.jpg"]
}
```

**Image URLs**: prefer `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/{relPath}`. Fall back to `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{relPath}` on error.

## Task

Build the exercise browser. Single tab/view for now (tabs come in Phase 2). Layout: search + filter chips at the top (sticky on mobile), scrollable list of exercise cards below, click a card to open a detail view (modal-style on mobile, side-pane on desktop ≥ md).

## Output format

### 1. Bundled data: `src/frontend/public/exercises.json`

Download from `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json` and commit verbatim. Approximately 1 MB. Acceptable per plan's PWA-bundle-impact note (lazy-fetched, not precached).

### 2. `src/frontend/apps/workout/types.ts`

```ts
export type ExerciseCategory =
  | 'strength'
  | 'cardio'
  | 'stretching'
  | 'plyometrics'
  | 'powerlifting'
  | 'olympic weightlifting'
  | 'strongman'

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert'

export type Force = 'pull' | 'push' | 'static' | null
export type Mechanic = 'compound' | 'isolation' | null

// Exhaustive muscle list per the dataset
export type Muscle =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves'
  | 'chest' | 'forearms' | 'glutes' | 'hamstrings' | 'lats'
  | 'lower back' | 'middle back' | 'neck' | 'quadriceps' | 'shoulders'
  | 'traps' | 'triceps'

// Exhaustive equipment list per the dataset
export type Equipment =
  | 'body only' | 'machine' | 'other' | 'foam roll' | 'kettlebells'
  | 'dumbbell' | 'cable' | 'barbell' | 'bands' | 'medicine ball'
  | 'exercise ball' | 'e-z curl bar'

export interface Exercise {
  id: string
  name: string
  force: Force
  level: ExerciseLevel
  mechanic: Mechanic
  equipment: Equipment
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  instructions: string[]
  category: ExerciseCategory
  images: string[]
}
```

If the implementer wants to be conservative, type `force`, `mechanic`, `equipment`, `category`, `level`, `Muscle` as the union plus `string` (so a row with a value not in the union doesn't break the build) — use a `& {}` intersection or fallback string for known-but-rare edge cases. Default approach: trust the dataset and use strict unions; surface a runtime warning if a row mismatches and skip it.

### 3. `src/frontend/apps/workout/data.ts`

```ts
import type { Exercise } from './types'

let cache: Exercise[] | null = null

export async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache
  const url = `${import.meta.env.BASE_URL}exercises.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load exercises: ${res.status}`)
  const data = (await res.json()) as Exercise[]
  cache = data
  return data
}

// Image URL helpers (prefer jsdelivr, fall back to raw.githubusercontent on error)
export function exerciseImageUrl(relPath: string, opts: { fallback?: boolean } = {}): string {
  return opts.fallback
    ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${relPath}`
    : `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${relPath}`
}
```

Component-level fallback pattern: render `<img src={primary} onError={(e) => { e.currentTarget.src = fallback }} />`. Use a small `<ExerciseImage>` sub-component if used in two places (it is — card thumbnail + detail view).

### 4. `src/frontend/apps/workout/ExerciseImage.tsx`

A `<img>` wrapper that handles the jsdelivr → GitHub raw fallback once. Props: `path: string`, `alt: string`, `className?: string`. Internally tracks a "use-fallback" state flipped by the first onError. Lazy-loaded via `loading="lazy"`.

### 5. `src/frontend/apps/workout/ExerciseCard.tsx`

A list-item card. Props: `exercise: Exercise`, `onClick: () => void`.

Visual: rounded card with the first image as a 96×96 px (mobile) / 80×80 (desktop) thumbnail on the left, name + equipment + level pill on the right. Level pills colored by level (beginner=green, intermediate=blue, expert=amber). Equipment shown as a small badge with the equipment name. Primary muscle(s) shown as small secondary text.

Tappable: whole card is a `<button>` with `text-left`, focus-visible ring, hover state. Mobile-friendly tap target (full card height ≥ 80 px).

### 6. `src/frontend/apps/workout/ExerciseDetail.tsx`

Full-screen modal on mobile; side panel on desktop ≥ md. Props: `exercise: Exercise`, `onClose: () => void`.

Layout:
- Header bar: name, close (✕) button. Sticky to top.
- Scrollable body:
  - Two `<ExerciseImage>` frames side-by-side (or stacked on narrow widths). Captions: "Start" / "End".
  - Metadata row: category, level pill, equipment, force, mechanic
  - "Muscles" section: primary (filled pills) + secondary (outline pills), colored by muscle group
  - "How to do it" numbered list from `exercise.instructions`
  - Attribution line at bottom: "Exercise data: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)"

Close on ✕, Escape key, and backdrop click (mobile only — desktop side-pane uses ✕ only).

### 7. `src/frontend/apps/workout/index.tsx`

Default-exported `Workout` component. Layout: `max-w-5xl mx-auto space-y-4` outer; on mobile single column; on `md+` two-column when a detail is open (list left, detail right ≈ 40/60).

State:
- `exercises: Exercise[] | null` — null while loading
- `loadError: string | null`
- `searchTerm: string` (persisted under `snappet:workout:search`)
- `filters: { categories: Set<ExerciseCategory>; levels: Set<ExerciseLevel>; equipment: Set<Equipment>; muscles: Set<Muscle> }` — empty Sets mean "no filter applied" (show all). Persisted under `snappet:workout:filters` as arrays.
- `selectedId: string | null` — currently-open exercise

UI:
- Header row (matches the project's header pattern): title "Workout" + description "Browse exercises with photos and instructions." + Reset (clears search + all filters)
- Sticky-top filter section:
  - Search input (full-width on mobile)
  - Collapsible "Filters" chip-row reveal: 4 sub-sections (Categories / Levels / Equipment / Muscles), each a wrap of toggle chips. Mobile-friendly tap-targets (`min-h-9`). Show count of active filters as a badge on the "Filters" button.
- Results count: "**N** exercises" (live, updates as filters change)
- Loading state: skeleton cards (6 placeholders)
- Error state: friendly message + Retry button
- Empty state (after filters): "No exercises match. Try clearing filters."
- The list of cards: render all matching exercises in document order. **No virtualization for v1** — measure first. Free Exercise DB has ~800 rows; after a typical filter most users see < 50. If unfiltered scrolling lags noticeably on a mid-range phone, switch to `react-window` (would be its own follow-up PR).

Filter behavior:
- Within a section: OR (any selected match passes)
- Across sections: AND (must match every section that has at least one selected)
- Muscle filter checks BOTH primaryMuscles AND secondaryMuscles
- Search matches `exercise.name.toLowerCase().includes(searchTerm.toLowerCase().trim())`

Open detail by clicking a card → `setSelectedId(id)`. Close → `setSelectedId(null)`.

### 8. `src/frontend/router/routes.tsx`

Extend `AppCategory` union to include `'Health'`:

```ts
export type AppCategory =
  | 'Utilities'
  | 'Calculators'
  | 'Productivity'
  | 'Developer Tools'
  | 'Creative'
  | 'Health'
```

Append route:

```ts
{
  path: '/workout',
  label: 'Workout',
  description: 'Browse 800+ exercises with photos and how-to instructions.',
  category: 'Health',
  icon: '💪',
  component: lazy(() => import('../apps/workout')),
},
```

### 9. `src/frontend/apps/hub/index.tsx` (verify, possibly tweak)

Inspect the hub's category filter to see if it lists categories dynamically or hard-codes them. If hard-coded, append 'Health'. (Most likely it's derived from the `routes` array — verify either way.)

## Acceptance criteria

- [ ] Loading `/workout` for the first time: skeleton cards, then 800 exercise cards visible after the JSON fetches
- [ ] Search box filters live by name (case-insensitive)
- [ ] Four filter sections (Category / Level / Equipment / Muscle) each work as OR within, AND across
- [ ] Selecting "Beginner" + "Body only" + "Chest" shows only beginner bodyweight chest exercises
- [ ] Tapping a card opens the detail view; both image frames load (or fall back gracefully to GitHub raw)
- [ ] Detail view shows: name, level pill, equipment, force, mechanic, primary + secondary muscles, instructions list, attribution
- [ ] ✕ button, Escape key, and (mobile) backdrop click all close the detail
- [ ] Reset button clears search and all filters
- [ ] State (search, filters) persists across reload
- [ ] Mobile (375 px): single-column layout; sticky filter bar; tap targets ≥ 44 px
- [ ] Desktop (≥ md, e.g. 1024 px): list on the left, detail panel on the right when open
- [ ] Dark mode on all elements
- [ ] `tsc --noEmit` clean; `npm run build` succeeds and the precache size doesn't exceed ~3.5 MB (the 1 MB JSON is NOT precached because it's fetched at runtime; verify the precache list in the build output does not include `exercises.json`)
- [ ] Attribution link visible in the detail view (footer line)

## Constraints

- **No new runtime dependencies** for Phase 1.
- TypeScript strict; no `any`. Unknown union edge cases handled with a runtime warning + skip, not a `// @ts-ignore`.
- **`exercises.json` must NOT land in the precache manifest** — load via runtime `fetch(import.meta.env.BASE_URL + 'exercises.json')`, not via `import`. Verify by reading the build's `dist/sw.js` for the precache list (or just the chunk-listing reported by vite-plugin-pwa).
- Image loading is lazy (`loading="lazy"`); the jsdelivr → GitHub raw fallback is one-time per `<img>`.
- All UI elements: dark mode + focus-visible rings; mobile tap targets ≥ 40 × 40 px.
- Filter Sets are persisted as arrays (Set isn't JSON-serializable directly); helper to round-trip.
- Pure additive change to `routes.tsx`; the only modification to existing code is adding `'Health'` to the `AppCategory` union and one entry. Hub may need a one-line update to surface the new category.

## Test plan

1. `npm run dev` — open `/workout` on desktop; verify skeleton → 800 cards
2. Type "squat" — filters to ~20 rows
3. Toggle Beginner + Body only + Quadriceps — should show a small handful
4. Click "Air Squat" (or first matching) — detail opens; both images load from jsdelivr
5. Disable network for `cdn.jsdelivr.net` only (devtools blockers) and reload a detail — images should auto-fall back to raw.githubusercontent.com
6. Reload the page — search + filters restored from localStorage
7. Devtools mobile emulation (iPhone): sticky filter bar; cards scroll smoothly; detail opens as full-screen modal
8. `npm run build` — verify `dist/exercises.json` exists (copied from `public/`) and does **not** appear in vite-plugin-pwa's precache entry count (which stays around 35–36)
