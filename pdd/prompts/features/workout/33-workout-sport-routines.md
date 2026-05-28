# Prompt: Workout app — Sport-tagged routines + search/filter + editor metadata

**File**: pdd/prompts/features/workout/33-workout-sport-routines.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Issue**: #35
**Research**: `pdd/context/research/workout-sport-routines.md` (+ amendment via PR #36)
**Plan**: `pdd/prompts/features/workout/PLAN-sport-routines.md`
**Depends on**: All Workout phases shipped on `main` (1–6). This is a single-PR change layered on top.

## Context

Anchor this prompt to **`main` as of PR #45**. Relevant existing shape:

- **Tabs** (`apps/workout/index.tsx`): `dashboard | browse | routines | history | settings`. **Do not add a tab.**
- **`Routine` type** (`apps/workout/types.ts`):
  ```ts
  interface Routine {
    id: string
    name: string
    exercises: RoutineExercise[]
    createdAt: number
    updatedAt: number
    isStarter?: boolean
    defaults?: RoutineDefaults   // Phase 5b — DO NOT REMOVE OR REORDER
  }
  ```
- **`RoutineExercise` type**: has `displayName?` (Phase 5a). Untouched here.
- **`RoutineEditor.tsx`**: name input → existing Defaults collapsible (5b, opens via `defaultsOpen` state) → exercise list. We add a *second sibling* "Advanced metadata" collapsible **above** the existing Defaults one. Both stay closed by default unless populated.
- **`RoutinesView`** (inside `index.tsx`): currently `<RoutineList ... onStart={...} />` only, no search, no filters.
- **`starters.ts`**: 6 generic routines, no metadata. None have `defaults` set.
- **Seeding** (`index.tsx`): `snappet:workout:starters-seeded: boolean` — one-shot flag, prepended `STARTER_ROUTINES` to user routines once. Replace with a dismissed-list approach (below).

This PR introduces the metadata, the library expansion, the Routines-tab search/filter, the editor disclosure, and the seeding migration — **in a single PR**.

## Output format

### 1. `src/frontend/apps/workout/types.ts` (extend, additive)

Append (do not touch existing fields):

```ts
// ── Sport-tagged routines (issue #35) ────────────────────────────────────

// Extensible. 'general' is the implicit bucket for user-created routines
// and pre-#35 starter routines; new sport keys can be added without code
// changes elsewhere as long as RoutineList/Filter rows mention them.
export type SportTag = 'general' | 'climbing' | 'calisthenics'

export type RoutineLevel = 'beginner' | 'intermediate' | 'advanced'

export interface RoutineSource {
  label: string
  url?: string
}

export interface Routine {
  // … existing fields stay exactly as-is …
  sport?: SportTag
  level?: RoutineLevel
  tags?: string[]
  description?: string
  source?: RoutineSource
}
```

**Constraint**: do not change the order of existing `Routine` fields. Add the new optional fields at the end of the interface.

### 2. `src/frontend/apps/workout/starters.ts` (edit + extend)

(a) Add `sport: 'general'` to all 6 existing starter routines (just that one new field — leave everything else exactly as-is).

(b) Append 9 new starter routines below the existing 6, per the research file's "Full routine specs" section. **Every `exerciseId` is already verified to exist** in `public/exercises.json`; do not change any ids. Use these *exact* properties on each new starter:

```ts
{
  id: '<stable-string-id>',
  name: '<routine name>',
  isStarter: true,
  createdAt: 0,
  updatedAt: 0,
  sport: 'climbing' | 'calisthenics',
  level: 'beginner' | 'intermediate' | 'advanced',
  tags: ['…'],
  description: '<1 short sentence>',
  source: { label: '<published source>', url: '<optional URL>' },
  exercises: [ /* per research file */ ],
}
```

Use these stable ids (match the research file's slugs so future runs are deterministic):

| id | name | sport | level |
|---|---|---|---|
| `starter-climbing-max-pull` | Climbing — Max Pulling Strength | climbing | intermediate |
| `starter-climbing-antagonist` | Climbing — Antagonist & Recovery | climbing | beginner |
| `starter-climbing-power-endurance` | Climbing — Power Endurance | climbing | intermediate |
| `starter-climbing-core` | Climbing — Core for Climbers | climbing | beginner |
| `starter-calisthenics-starting-strength` | Calisthenics — Starting Strength | calisthenics | beginner |
| `starter-calisthenics-push` | Calisthenics — Push Strength | calisthenics | intermediate |
| `starter-calisthenics-pull` | Calisthenics — Pull Strength | calisthenics | intermediate |
| `starter-calisthenics-lower` | Calisthenics — Single-Leg & Lower | calisthenics | intermediate |
| `starter-calisthenics-skill` | Calisthenics — Skill & Conditioning | calisthenics | advanced |

Sources for the `source` field (label exactly as written):
- Climbing Max Pull: `{ label: 'Hörst, Training for Climbing' }`
- Climbing Antagonist: `{ label: 'Lattice Training blog', url: 'https://latticetraining.com/blog/' }`
- Climbing Power Endurance: `{ label: 'Bechtel, Logical Progression' }`
- Climbing Core: `{ label: 'General climbing canon' }`
- Calisthenics Starting Strength: `{ label: 'r/bodyweightfitness Recommended Routine', url: 'https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine' }`
- Calisthenics Push: `{ label: 'GMB Elements', url: 'https://gmb.io/elements/' }`
- Calisthenics Pull: `{ label: 'r/bodyweightfitness Move', url: 'https://www.reddit.com/r/bodyweightfitness/' }`
- Calisthenics Lower: `{ label: 'Convict Conditioning progressions' }`
- Calisthenics Skill: `{ label: 'GMB Foundations', url: 'https://gmb.io/foundations/' }`

Tags should be lowercase short words from the research file (`pull`, `strength`, `antagonist`, `mobility`, `recovery`, `endurance`, `core`, `full-body`, `push`, `legs`, `unilateral`, `skill`, `conditioning`).

`exercises` arrays: copy verbatim from the research file's "Full routine specs" `<details>` block. Keep the `reps` string values as written ("8-12", "max-2", "max", "30s each side", etc.). For the special `'max'` / `'max-2'` repless strings, no change — they're already opaque strings throughout the app.

### 3. `src/frontend/apps/workout/RoutineList.tsx` (edit — card additions)

The existing card already shows name + exercise count + ~min + first thumbnails + actions. Add:

- **Sport badge** to the right of the routine name (only if `routine.sport && routine.sport !== 'general'`):
  ```ts
  const SPORT_BADGE: Record<Exclude<SportTag, 'general'>, string> = {
    climbing:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    calisthenics: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  }
  ```
  Render: `<span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SPORT_BADGE[sport]}`}>{sport}</span>`. Mirror the existing "Starter" pill placement / styling so they read naturally next to each other.

- **Level pill** (when `routine.level` is set) — reuse the colors already used for `ExerciseLevel` in `ExerciseCard.tsx`:
  - beginner: green-100/700 (dark: green-900/40 / green-300)
  - intermediate: blue-100/700
  - advanced: amber-100/700 (we don't have "advanced" in ExerciseLevel — use the same amber as "expert" there for visual consistency)

- **Description** — small italic `text-xs text-gray-500 dark:text-gray-400` line below the meta line; only if present. Single-line `line-clamp-1`.

- **Source citation footer** — when `routine.source` is set, render a tiny one-line footer:
  ```tsx
  <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 truncate">
    Source:{' '}
    {routine.source.url
      ? <a href={routine.source.url} target="_blank" rel="noopener noreferrer"
           className="underline hover:text-blue-600 dark:hover:text-blue-400"
           onClick={(e) => e.stopPropagation()}>{routine.source.label}</a>
      : routine.source.label}
  </p>
  ```
  Note the `e.stopPropagation()` so tapping the link doesn't also fire the card's "edit" action.

All four card additions are purely additive — routines without metadata render exactly as before.

### 4. `src/frontend/apps/workout/RoutinesView` (in `index.tsx`) — search + filter

`RoutinesView` is currently a small inline component inside `index.tsx`. Extend it; don't extract a new file unless the diff gets noisy.

State to add inside `RoutinesView`:
```ts
const [search, setSearch] = useLocalStorage<string>('snappet:workout:routine-search', '')
const [filters, setFilters] = useLocalStorage<{
  sport: SportTag | null
  level: RoutineLevel | null
}>('snappet:workout:routine-filters', { sport: null, level: null })
const [filtersOpen, setFiltersOpen] = useState(false)
```

Mirror the `ExerciseBrowser.tsx` (Phase 1) sticky-top control bar visually — match its spacing, blur, pill classes — so the two tabs feel consistent. Specifically:

- Sticky container with `top-[57px]` (same as Browse; that's the global header height — already a convention in this app)
- Search input (full-width, `inputmode="search"`, lower-case match across `routine.name + (routine.description ?? '')`)
- "Filters" button with the same active-count badge pattern (count of non-null fields in `filters`)
- When `filtersOpen`, reveal a panel with two single-select chip rows:
  - **Sport**: `All / General / Climbing / Calisthenics`
  - **Level**: `All / Beginner / Intermediate / Advanced`
- A muted "N routines" count line below

Filter logic:
```ts
const filtered = useMemo(() => {
  const term = search.trim().toLowerCase()
  return routines.filter((r) => {
    if (term && !`${r.name} ${r.description ?? ''}`.toLowerCase().includes(term)) return false
    if (filters.sport && (r.sport ?? 'general') !== filters.sport) return false
    if (filters.level && r.level !== filters.level) return false
    return true
  })
}, [routines, search, filters])
```

(User-created routines with no `level` set fail any active level filter — by design.)

Pass `filtered` to `<RoutineList routines={filtered} … />` so its existing rendering doesn't change. The count badge already exists in the tab strip (`Routines (N)`) — keep it showing **total** routine count, not filtered. The "N routines" line under filters shows the filtered count.

**Empty state for "no matches"** — show below the controls (replace the existing `<RoutineList />` render when `filtered.length === 0` and (`search !== ''` or any filter is set)):
```
"No routines match. Try clearing filters or adding your own."
[Clear filters]   [+ New Routine]
```

The "+ New Routine" button reuses the existing onNew handler the editor wires up.

### 5. `src/frontend/apps/workout/RoutineEditor.tsx` — Advanced metadata disclosure

Add as a **sibling collapsible above the existing Defaults block**, just below the Name input. Same visual treatment as the Defaults block (`<details>` with a header summary). Both default closed when neither has data; the metadata block opens by default if any of `routine.description / sport / level / tags / source` is set.

Local state:
```ts
const [description, setDescription] = useState<string>(routine?.description ?? '')
const [sport, setSport] = useState<SportTag | undefined>(routine?.sport)
const [level, setLevel] = useState<RoutineLevel | undefined>(routine?.level)
const [tags, setTags] = useState<string[]>(routine?.tags ?? [])
const [tagDraft, setTagDraft] = useState<string>('')
const [sourceLabel, setSourceLabel] = useState<string>(routine?.source?.label ?? '')
const [sourceUrl, setSourceUrl] = useState<string>(routine?.source?.url ?? '')

const [metadataOpen, setMetadataOpen] = useState<boolean>(() => {
  return Boolean(
    routine?.description || routine?.sport || routine?.level ||
    (routine?.tags && routine.tags.length > 0) || routine?.source
  )
})
```

UI (collapsed: header only; expanded: inputs):

```
┌─────────────────────────────────────────────────────────┐
│ Advanced metadata                          [Expand ▼]   │  ← header row
└─────────────────────────────────────────────────────────┘
                ↓ (expanded)
┌─────────────────────────────────────────────────────────┐
│ Description                                             │
│ [<input one-line, placeholder "What's this routine">]  │
│                                                         │
│ Sport                                                   │
│ [None | General | Climbing | Calisthenics] (chip row)  │
│                                                         │
│ Level                                                   │
│ [None | Beginner | Intermediate | Advanced] (chip row) │
│                                                         │
│ Tags                                                    │
│ [pull ×] [strength ×]  [< input "Add tag" + Enter >]   │
│                                                         │
│ Source                                                  │
│ Label: [_____________]                                 │
│ URL  : [_____________]  (optional)                     │
└─────────────────────────────────────────────────────────┘
```

Tag input behavior:
- Enter or comma in the input → commit `tagDraft.trim().toLowerCase()` (dedup); clear `tagDraft`
- Click × on a chip → remove
- Disallow empty / whitespace-only

Source URL: `<input type="url" inputMode="url">`; no protocol validation. If the URL is malformed, just render as plain text in cards.

**Save** (extend the existing `handleSave`):

```ts
const saved: Routine = {
  // … existing fields …
  description: description.trim() === '' ? undefined : description.trim(),
  sport: sport ?? undefined,
  level: level ?? undefined,
  tags: tags.length > 0 ? tags : undefined,
  source: sourceLabel.trim() === '' ? undefined : {
    label: sourceLabel.trim(),
    ...(sourceUrl.trim() === '' ? {} : { url: sourceUrl.trim() }),
  },
}
```

Setting empty fields to `undefined` keeps serialized routines tidy and means user-created routines that never touch the disclosure stay metadata-free.

### 6. `src/frontend/apps/workout/index.tsx` — seeding migration

Replace the existing block:
```ts
const [startersSeeded, setStartersSeeded] = useLocalStorage<boolean>(
  'snappet:workout:starters-seeded',
  false,
)
// …
useEffect(() => {
  if (!startersSeeded) {
    setRoutines((prev) => [...STARTER_ROUTINES, ...prev])
    setStartersSeeded(true)
  }
}, [])
```

…with the dismissed-list approach:
```ts
const [startersDismissed, setStartersDismissed] = useLocalStorage<string[]>(
  'snappet:workout:starters-dismissed',
  [],
)

useEffect(() => {
  setRoutines((prev) => {
    const have = new Set(prev.map((r) => r.id))
    const dismissed = new Set(startersDismissed)
    const missing = STARTER_ROUTINES.filter((s) => !have.has(s.id) && !dismissed.has(s.id))
    if (missing.length === 0) return prev
    return [...missing, ...prev]
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

(Leave the old `startersSeeded` localStorage key alone — DON'T migrate it; DON'T delete it. It just becomes orphaned data. A future cleanup PR can drop it.)

**Wire dismissed tracking into deletion** — the orchestrator currently passes `onDelete` to `RoutinesView`'s `RoutineList`. Augment that handler so deleting a starter pushes to `startersDismissed`:

```ts
function handleRoutineDelete(id: string) {
  const r = routines.find((x) => x.id === id)
  setRoutines((prev) => prev.filter((x) => x.id !== id))
  if (r?.isStarter && !startersDismissed.includes(id)) {
    setStartersDismissed((d) => [...d, id])
  }
}
```

Pass `handleRoutineDelete` down where the existing delete handler is wired. (The `RoutinesView` already has a `handleDelete` — keep that local one for non-starter deletions OR route everything through the orchestrator-level handler. Pick whichever fits the existing structure with the smaller diff; result must be: starter deletions update `startersDismissed`.)

### 7. `src/frontend/apps/workout/index.tsx` — pass new metadata-aware props (if any)

No new props needed if RoutineList reads `routine.sport / .level / .description / .source` directly from each routine. RoutinesView passes `routines={filtered}` (post search + filter) to RoutineList. Everything else flows the same.

## Quality criteria

- **Backwards-compatible storage**: existing `snappet:workout:routines` blob (no metadata) round-trips and behaves identically. Existing user routines without metadata remain visible under the "All" / no-filter view. Setting a sport filter excludes them if they have no `sport`; setting `sport: General` includes them.
- **Predictable seeding migration**: existing user with `starters-seeded: true` sees the 9 new sport-tagged starters appear on next load; their existing 6 starters (any not deleted) stay; any v1 starter they previously deleted re-appears once (acceptable per the plan's documented trade-off), and re-deleting now persists in `starters-dismissed`.
- **No regressions** to: Defaults block (5b), per-row rename (5a), per-row arrows / × / weight / notes, Player, Browser, Picker, History, SessionDetail, Settings, Dashboard.
- **Tap targets ≥ 44 px** on the new chip rows, tag input, source inputs, and the disclosure header on mobile.
- **No new dependencies.**
- **TS strict, no `any`.** SportTag/RoutineLevel/RoutineSource fully typed.
- **Dark mode** on all new UI elements.

## Don't change

- Tab structure (5 tabs stays).
- `defaults?: RoutineDefaults` field on Routine (Phase 5b) — keep its position, type, and editor block.
- `displayName?` on RoutineExercise (Phase 5a).
- `RoutineExercise` schema in any way.
- `starters-seeded` localStorage key — leave the orphaned data alone.
- The Phase 5a search behavior (exercise-name stem/token match) — this PR adds a *different* search for the Routines tab.

## Acceptance (mirrors issue #35)

- [ ] `Routine` type extended with optional `sport / level / tags / description / source`; existing user routines round-trip without migration
- [ ] `STARTER_ROUTINES` has all 6 existing routines tagged `sport: 'general'` + 9 new sport-tagged routines (4 climbing + 5 calisthenics)
- [ ] All 15 starter `exerciseId` values exist in `public/exercises.json` (test by grep or a build-time check if easy; manual verification at minimum)
- [ ] Routines tab: sticky search input filters by name + description (case-insensitive, live)
- [ ] Sport filter chip row (All / General / Climbing / Calisthenics) — single-select
- [ ] Level filter chip row (All / Beginner / Intermediate / Advanced) — single-select
- [ ] Active filter count badge on Filters button
- [ ] Filters + search persist across reload under `snappet:workout:routine-filters` and `snappet:workout:routine-search`
- [ ] Routine cards show: sport badge (when not 'general'), level pill, description (line-clamp-1), source citation footer (clickable when URL set)
- [ ] Empty state when filters/search match nothing: message + Clear filters + + New Routine buttons
- [ ] RoutineEditor has an "Advanced metadata" disclosure above the Defaults block
- [ ] Disclosure opens by default if any metadata is set; closed by default otherwise
- [ ] Description, Sport, Level chip rows, Tags chip input (Enter / comma to commit, dedup, × to remove), Source label + optional URL all functional
- [ ] Saving a routine with metadata persists those fields
- [ ] Saving a routine WITHOUT touching the disclosure persists with no new fields (verify in DevTools localStorage)
- [ ] Seeding migration: `starters-dismissed` defaults to `[]`; deleting a starter routine pushes its id into the list; future loads seed only `STARTER_ROUTINES` whose id is NOT already in the user's routines AND NOT in dismissed
- [ ] User-created routines without `sport` show under the "General" filter
- [ ] Mobile (375 px): sticky control bar, chip rows wrap, source citation truncates, tag input usable with one thumb
- [ ] Dark mode on all new UI
- [ ] `tsc --noEmit` clean; `vite build` clean; precache delta < 10 KiB

## Test plan

1. `npm run dev`
2. Open `/workout` → Routines tab
3. Verify all 15 starters present (6 generic + 4 climbing + 5 calisthenics), each climbing/calisthenics card showing its sport badge + level pill + description + source citation
4. Search "climb" → only climbing routines remain
5. Toggle Sport: Calisthenics → only calisthenics routines
6. Toggle Level: Advanced → only advanced routines (Calisthenics — Skill & Conditioning)
7. Combine: Sport=Climbing + Level=Beginner → only Antagonist & Recovery and Core for Climbers
8. Search "nonsense" → empty state with Clear filters + New Routine buttons
9. Tap a starter routine → Editor opens. Open "Advanced metadata" → fields pre-populated. Change Level to advanced, save. Reload → metadata persists.
10. New Routine → fill name + 2 exercises → open "Advanced metadata" → set sport=climbing, level=intermediate, add tags `[pull, finger]`, source label "Hörst Training for Climbing", URL "https://example.com". Save. Re-open → all metadata round-trips.
11. Delete a starter (e.g. one of the new climbing ones) → reload page → it does NOT re-appear; `snappet:workout:starters-dismissed` in localStorage contains its id
12. Source citation link click → opens in new tab; does NOT trigger the card's edit action
13. `tsc --noEmit` and `npm run build` both clean

## Next step

Implement → `/project:pdd-review` → PR → merge → close issue #35.
