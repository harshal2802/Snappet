import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'
import Dashboard from './Dashboard'
import ExerciseBrowser from './ExerciseBrowser'
import HistoryView from './HistoryView'
import RoutineEditor from './RoutineEditor'
import RoutineList from './RoutineList'
import SettingsView from './SettingsView'
import WorkoutPlayer from './WorkoutPlayer'
import { loadExercises } from './data'
import { CUSTOM_EXERCISES_KEY, mergeCatalog } from './customExercises'
import { STARTER_ROUTINES } from './starters'
import { generateId } from './utils'
import type {
  Exercise,
  Routine,
  RoutineLevel,
  SetLog,
  SportTag,
  WeightUnit,
  WorkoutSession,
} from './types'

type Tab = 'dashboard' | 'browse' | 'routines' | 'history' | 'settings'

// shrink-0 keeps each tab at its natural content width — combined with the
// strip's overflow-x-auto, the strip scrolls horizontally when 5 tabs don't
// fit on narrow phones, instead of compressing labels into ellipsis.
const TAB_BTN_BASE =
  'shrink-0 px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const TAB_BTN_ACTIVE = 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
const TAB_BTN_INACTIVE = 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

export default function Workout() {
  const [tab, setTab] = useLocalStorage<Tab>('snappet:workout:tab', 'dashboard')
  // One-shot id buffer for cross-tab navigation (e.g. Dashboard → Browse on a
  // PR row click). In-memory only; doesn't survive page reload.
  const [pendingExerciseId, setPendingExerciseId] = useState<string | null>(null)
  const [routines, setRoutines] = useLocalStorage<Routine[]>('snappet:workout:routines', [])
  // Issue #35 — per-id dismissed list replaces the Phase 2 one-shot
  // `starters-seeded` boolean. Lets newly-added starters (the 9 sport-tagged
  // ones in this PR, plus any future additions) reach existing users without
  // re-seeding starters they previously deleted.
  const [startersDismissed, setStartersDismissed] = useLocalStorage<string[]>(
    'snappet:workout:starters-dismissed',
    [],
  )
  const [activeSession, setActiveSession] = useLocalStorage<WorkoutSession | null>(
    'snappet:workout:active-session',
    null,
  )
  const [history, setHistory] = useLocalStorage<WorkoutSession[]>(
    'snappet:workout:history',
    [],
  )
  const [preferredUnit, setPreferredUnit] = useLocalStorage<WeightUnit>(
    'snappet:workout:preferred-unit',
    'kg',
  )

  // Seed any starter whose id isn't already in the user's routines AND isn't
  // in `starters-dismissed`. Runs on every load (no flag), but no-ops when
  // there's nothing missing. The orphaned `snappet:workout:starters-seeded`
  // boolean from Phase 2 is intentionally left untouched.
  useEffect(() => {
    setRoutines((prev) => {
      const have = new Set(prev.map((r) => r.id))
      const dismissed = new Set(startersDismissed)
      const missing = STARTER_ROUTINES.filter(
        (s) => !have.has(s.id) && !dismissed.has(s.id),
      )
      if (missing.length === 0) return prev
      return [...missing, ...prev]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load exercises once at the orchestrator level so RoutinesView + picker
  // share the same cached data with ExerciseBrowser (data.ts memoizes anyway,
  // but lifting it here avoids the loading flicker in the picker).
  const [exercises, setExercises] = useState<Exercise[]>([])
  useEffect(() => {
    loadExercises()
      .then(setExercises)
      .catch(() => {
        // ExerciseBrowser surfaces its own error UI when it tries to load;
        // routine views degrade gracefully showing exercise IDs.
      })
  }, [])
  // Phase 7 — user-created exercises stored in localStorage. Merged into the
  // catalog (customs first) so they flow into every surface that resolves
  // exercises by id from `exerciseById`: Picker, RoutineEditor, Player,
  // History, SessionDetail, Dashboard.
  const [customExercises, setCustomExercises] = useLocalStorage<Exercise[]>(
    CUSTOM_EXERCISES_KEY,
    [],
  )
  const allExercises = useMemo(
    () => mergeCatalog(exercises, customExercises),
    [exercises, customExercises],
  )
  const exerciseById = useMemo(
    () => new Map(allExercises.map((e) => [e.id, e])),
    [allExercises],
  )

  function handleSaveCustomExercise(ex: Exercise) {
    setCustomExercises((prev) => {
      const i = prev.findIndex((x) => x.id === ex.id)
      if (i === -1) return [...prev, ex]
      const next = [...prev]
      next[i] = ex
      return next
    })
  }

  function handleDeleteCustomExercise(id: string) {
    // Intentionally does NOT touch routines/history — orphan rows degrade
    // gracefully via getDisplayName()'s `(id)` fallback.
    setCustomExercises((prev) => prev.filter((x) => x.id !== id))
  }

  function countExerciseReferences(id: string): { routines: number; sessions: number } {
    return {
      routines: routines.filter((r) => r.exercises.some((e) => e.exerciseId === id)).length,
      sessions: history.filter((s) => s.exercises.some((e) => e.exerciseId === id)).length,
    }
  }

  // Reset counter for Browse tab — ExerciseBrowser watches this and clears
  // its search/filters/selection when it increments.
  const [browseResetCounter, setBrowseResetCounter] = useState(0)

  // If a session is active (incl. restored from localStorage after refresh),
  // take over the whole view with the player.
  if (activeSession) {
    return (
      <WorkoutPlayer
        session={activeSession}
        setSession={setActiveSession}
        exerciseById={exerciseById}
        preferredUnit={preferredUnit}
        setPreferredUnit={setPreferredUnit}
        onFinish={(final) => {
          setHistory((h) => [final, ...h])
          setActiveSession(null)
        }}
        onAbandon={() => setActiveSession(null)}
      />
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div data-tour="header">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Workout</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse 800+ exercises and build your own routines.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="workout" steps={tourSteps} />
          {tab === 'browse' && (
            <button
              onClick={() => setBrowseResetCounter((c) => c + 1)}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-full sm:w-fit overflow-x-auto" data-tour="tabs">
        <button
          onClick={() => setTab('dashboard')}
          aria-pressed={tab === 'dashboard'}
          className={`${TAB_BTN_BASE} ${tab === 'dashboard' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setTab('browse')}
          aria-pressed={tab === 'browse'}
          data-tour="browse-tab"
          className={`${TAB_BTN_BASE} ${tab === 'browse' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          Browse
        </button>
        <button
          onClick={() => setTab('routines')}
          aria-pressed={tab === 'routines'}
          data-tour="routines-tab"
          className={`${TAB_BTN_BASE} ${tab === 'routines' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          Routines
          {routines.length > 0 && (
            <span className="ml-1 text-gray-400 dark:text-gray-500">({routines.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          aria-pressed={tab === 'history'}
          className={`${TAB_BTN_BASE} ${tab === 'history' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          History
          {history.length > 0 && (
            <span className="ml-1 text-gray-400 dark:text-gray-500">({history.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab('settings')}
          aria-pressed={tab === 'settings'}
          className={`${TAB_BTN_BASE} ${tab === 'settings' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          Settings
        </button>
      </div>

      {/* Body */}
      {tab === 'dashboard' && (
        <div data-tour="dashboard-body">
          <Dashboard
            history={history}
            exerciseById={exerciseById}
            preferredUnit={preferredUnit}
            onOpenExercise={(id) => {
              setPendingExerciseId(id)
              setTab('browse')
            }}
            onGoToRoutines={() => setTab('routines')}
          />
        </div>
      )}
      {tab === 'browse' && (
        <ExerciseBrowser
          resetSignal={browseResetCounter}
          history={history}
          preferredUnit={preferredUnit}
          pendingExerciseId={pendingExerciseId}
          onConsumePending={() => setPendingExerciseId(null)}
          customExercises={customExercises}
          onSaveCustom={handleSaveCustomExercise}
          onDeleteCustom={handleDeleteCustomExercise}
          getReferenceCounts={countExerciseReferences}
        />
      )}
      {tab === 'history' && (
        <HistoryView
          history={history}
          exerciseById={exerciseById}
          preferredUnit={preferredUnit}
        />
      )}
      {tab === 'settings' && (
        <SettingsView
          preferredUnit={preferredUnit}
          setPreferredUnit={setPreferredUnit}
        />
      )}
      {tab === 'routines' && (
        <RoutinesView
          routines={routines}
          setRoutines={setRoutines}
          exercises={allExercises}
          exerciseById={exerciseById}
          preferredUnit={preferredUnit}
          onDismissStarter={(id) => {
            setStartersDismissed((d) => (d.includes(id) ? d : [...d, id]))
          }}
          onStartRoutine={(routineId) => {
            const r = routines.find((x) => x.id === routineId)
            if (!r || r.exercises.length === 0) return
            const session: WorkoutSession = {
              id: generateId(),
              routineId: r.id,
              routineName: r.name,
              startedAt: Date.now(),
              exercises: r.exercises.map((re) => ({
                exerciseId: re.exerciseId,
                targetSets: re.sets,
                targetReps: re.reps,
                targetRestSeconds: re.restSeconds,
                targetWeight: re.weight,
                targetWeightUnit: re.weightUnit,
                displayName: re.displayName,
                sets: Array.from({ length: re.sets }, () => ({} as SetLog)),
              })),
            }
            setActiveSession(session)
          }}
        />
      )}
    </div>
  )
}

interface RoutinesViewProps {
  routines: Routine[]
  setRoutines: React.Dispatch<React.SetStateAction<Routine[]>>
  exercises: Exercise[]
  exerciseById: Map<string, Exercise>
  preferredUnit: WeightUnit
  onStartRoutine: (routineId: string) => void
  /** Issue #35 — when a starter is deleted, push its id into the dismissed
   *  list so the seeding effect doesn't re-add it on next load. */
  onDismissStarter: (id: string) => void
}

function RoutinesView({
  routines,
  setRoutines,
  exercises,
  exerciseById,
  preferredUnit,
  onStartRoutine,
  onDismissStarter,
}: RoutinesViewProps) {
  type EditTarget = null | 'new' | string
  const [editingId, setEditingId] = useState<EditTarget>(null)

  // Issue #35 — search + filter state (separate from Browse-tab keys).
  const [search, setSearch] = useLocalStorage<string>(
    'snappet:workout:routine-search',
    '',
  )
  const [filters, setFilters] = useLocalStorage<{
    sport: SportTag | null
    level: RoutineLevel | null
  }>('snappet:workout:routine-filters', { sport: null, level: null })
  const [filtersOpen, setFiltersOpen] = useState(false)

  const editingRoutine =
    editingId && editingId !== 'new' ? routines.find((r) => r.id === editingId) ?? null : null

  function handleSave(r: Routine) {
    setRoutines((prev) => {
      if (editingId === 'new') return [...prev, r]
      return prev.map((x) => (x.id === r.id ? r : x))
    })
    setEditingId(null)
  }

  function handleDelete(id: string) {
    const r = routines.find((x) => x.id === id)
    setRoutines((prev) => prev.filter((x) => x.id !== id))
    if (editingId === id) setEditingId(null)
    if (r?.isStarter) onDismissStarter(id)
  }

  function handleDuplicate(id: string) {
    const src = routines.find((r) => r.id === id)
    if (!src) return
    const now = Date.now()
    const copy: Routine = {
      ...src,
      id: generateId(),
      name: `${src.name} (copy)`,
      isStarter: false,
      createdAt: now,
      updatedAt: now,
      exercises: src.exercises.map((e) => ({ ...e })),
    }
    setRoutines((prev) => [...prev, copy])
  }

  if (editingId !== null) {
    return (
      <RoutineEditor
        routine={editingRoutine}
        exercises={exercises}
        exerciseById={exerciseById}
        preferredUnit={preferredUnit}
        onSave={handleSave}
        onCancel={() => setEditingId(null)}
        onDelete={editingRoutine ? handleDelete : undefined}
      />
    )
  }

  // Apply search + filters to the visible routine list
  const filtered = routines.filter((r) => {
    const term = search.trim().toLowerCase()
    if (term) {
      const haystack = `${r.name} ${r.description ?? ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }
    if (filters.sport && (r.sport ?? 'general') !== filters.sport) return false
    if (filters.level && r.level !== filters.level) return false
    return true
  })

  const activeFilterCount = (filters.sport ? 1 : 0) + (filters.level ? 1 : 0)
  const isFiltering = search.trim() !== '' || activeFilterCount > 0

  return (
    <div className="space-y-3">
      {/* Sticky search + filters (mirrors ExerciseBrowser's pattern) */}
      <div className="sticky top-[57px] z-10 -mx-3 px-3 py-2 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="search"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search routines…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-3">
            <RoutineFilterRow
              label="Sport"
              options={['general', 'climbing', 'calisthenics']}
              selected={filters.sport}
              onSelect={(v) => setFilters((f) => ({ ...f, sport: v as SportTag | null }))}
            />
            <RoutineFilterRow
              label="Level"
              options={['beginner', 'intermediate', 'advanced']}
              selected={filters.level}
              onSelect={(v) => setFilters((f) => ({ ...f, level: v as RoutineLevel | null }))}
            />
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {filtered.length.toLocaleString()} routine{filtered.length === 1 ? '' : 's'}
          {isFiltering && routines.length !== filtered.length
            ? ` of ${routines.length.toLocaleString()}`
            : ''}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No routines match. Try clearing filters or adding your own.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                setSearch('')
                setFilters({ sport: null, level: null })
              }}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Clear filters
            </button>
            <button
              onClick={() => setEditingId('new')}
              className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              + New Routine
            </button>
          </div>
        </div>
      ) : (
        <RoutineList
          routines={filtered}
          exerciseById={exerciseById}
          onNew={() => setEditingId('new')}
          onEdit={(id) => setEditingId(id)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onStart={onStartRoutine}
        />
      )}
    </div>
  )
}

// ── Small helper for the Routines tab filter chip rows ──────────────────────

interface RoutineFilterRowProps {
  label: string
  options: string[]
  selected: string | null
  onSelect: (value: string | null) => void
}

function RoutineFilterRow({ label, options, selected, onSelect }: RoutineFilterRowProps) {
  const PILL_BASE =
    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
  const PILL_ACTIVE =
    'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
  const PILL_INACTIVE =
    'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelect(null)}
          aria-pressed={selected === null}
          className={`${PILL_BASE} ${selected === null ? PILL_ACTIVE : PILL_INACTIVE}`}
        >
          All
        </button>
        {options.map((opt) => {
          const active = selected === opt
          return (
            <button
              key={opt}
              onClick={() => onSelect(active ? null : opt)}
              aria-pressed={active}
              className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
