import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { loadExercises } from './data'
import { ESSENTIAL_ID_SET } from './essentials'
import { buildSearchBag, matchesQuery } from './search'
import ExerciseCard from './ExerciseCard'
import ExerciseDetail from './ExerciseDetail'
import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseFiltersSerialized,
  ExerciseLevel,
  Muscle,
  WorkoutSession,
} from './types'

const ALL_CATEGORIES: ExerciseCategory[] = [
  'strength',
  'cardio',
  'stretching',
  'plyometrics',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
]

const ALL_LEVELS: ExerciseLevel[] = ['beginner', 'intermediate', 'expert']

const ALL_EQUIPMENT: Equipment[] = [
  'body only',
  'dumbbell',
  'barbell',
  'cable',
  'machine',
  'kettlebells',
  'bands',
  'medicine ball',
  'exercise ball',
  'foam roll',
  'e-z curl bar',
  'other',
]

const ALL_MUSCLES: Muscle[] = [
  'abdominals',
  'biceps',
  'triceps',
  'chest',
  'shoulders',
  'forearms',
  'lats',
  'middle back',
  'lower back',
  'traps',
  'neck',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abductors',
  'adductors',
]

const EMPTY_FILTERS: ExerciseFiltersSerialized = {
  categories: [],
  levels: [],
  equipment: [],
  muscles: [],
}

function matchesFilters(ex: Exercise, filters: ExerciseFiltersSerialized): boolean {
  if (filters.categories.length > 0 && !filters.categories.includes(ex.category)) return false
  if (filters.levels.length > 0 && !filters.levels.includes(ex.level)) return false
  if (filters.equipment.length > 0 && !filters.equipment.includes(ex.equipment)) return false
  if (filters.muscles.length > 0) {
    const all = new Set<Muscle>([...ex.primaryMuscles, ...ex.secondaryMuscles])
    if (!filters.muscles.some((m) => all.has(m))) return false
  }
  return true
}

const PILL_BASE =
  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const PILL_ACTIVE = 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
const PILL_INACTIVE =
  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

interface FilterRowProps<T extends string> {
  label: string
  options: T[]
  selected: T[]
  onToggle: (value: T) => void
}

function FilterRow<T extends string>({ label, options, selected, onToggle }: FilterRowProps<T>) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              aria-pressed={isActive}
              className={`${PILL_BASE} ${isActive ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  )
}

interface ExerciseBrowserProps {
  /** Incremented by the parent when the user clicks Reset; we clear state on change. */
  resetSignal: number
  history: WorkoutSession[]
}

export default function ExerciseBrowser({ resetSignal, history }: ExerciseBrowserProps) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useLocalStorage<string>('snappet:workout:search', '')
  const [filters, setFilters] = useLocalStorage<ExerciseFiltersSerialized>(
    'snappet:workout:filters',
    EMPTY_FILTERS,
  )
  const [essentialsOnly, setEssentialsOnly] = useLocalStorage<boolean>(
    'snappet:workout:essentials-only',
    true,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadExercises()
      .then((data) => {
        if (!cancelled) setExercises(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load exercises')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reset signal from parent — guard against the initial value running on mount.
  const initialResetRef = useRef(true)
  useEffect(() => {
    if (initialResetRef.current) {
      initialResetRef.current = false
      return
    }
    setSearchTerm('')
    setFilters(EMPTY_FILTERS)
    setSelectedId(null)
  }, [resetSignal])

  function toggle<T extends keyof ExerciseFiltersSerialized>(
    key: T,
    value: ExerciseFiltersSerialized[T][number],
  ) {
    setFilters((prev) => {
      const current = prev[key] as Array<typeof value>
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  const bagsById = useMemo(() => {
    const m = new Map<string, string[]>()
    if (!exercises) return m
    for (const ex of exercises) m.set(ex.id, buildSearchBag(ex))
    return m
  }, [exercises])

  const filtered = useMemo(() => {
    if (!exercises) return []
    return exercises.filter((ex) => {
      if (essentialsOnly && !ESSENTIAL_ID_SET.has(ex.id)) return false
      if (!matchesQuery(bagsById.get(ex.id) ?? [], searchTerm)) return false
      return matchesFilters(ex, filters)
    })
  }, [exercises, searchTerm, filters, bagsById, essentialsOnly])

  const selected = useMemo(
    () => (selectedId ? exercises?.find((e) => e.id === selectedId) ?? null : null),
    [exercises, selectedId],
  )

  const activeFilterCount =
    filters.categories.length +
    filters.levels.length +
    filters.equipment.length +
    filters.muscles.length

  return (
    <div className="space-y-4">
      {/* Sticky-top controls */}
      <div className="sticky top-[57px] z-10 -mx-3 px-3 py-2 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search exercises…"
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
            <FilterRow
              label="Category"
              options={ALL_CATEGORIES}
              selected={filters.categories}
              onToggle={(v) => toggle('categories', v)}
            />
            <FilterRow
              label="Level"
              options={ALL_LEVELS}
              selected={filters.levels}
              onToggle={(v) => toggle('levels', v)}
            />
            <FilterRow
              label="Equipment"
              options={ALL_EQUIPMENT}
              selected={filters.equipment}
              onToggle={(v) => toggle('equipment', v)}
            />
            <FilterRow
              label="Muscle"
              options={ALL_MUSCLES}
              selected={filters.muscles}
              onToggle={(v) => toggle('muscles', v)}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden text-xs">
            {([
              { value: true, label: 'Essentials' },
              { value: false, label: 'All exercises' },
            ] as const).map((opt) => {
              const active = essentialsOnly === opt.value
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => setEssentialsOnly(opt.value)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {exercises === null && loadError === null
              ? 'Loading…'
              : loadError !== null
                ? ''
                : `${filtered.length.toLocaleString()} exercise${filtered.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {/* Body — two columns on md+ when a card is selected */}
      <div className={`grid gap-4 ${selected ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]' : ''}`}>
        {/* List */}
        <div className="space-y-2">
          {loadError !== null && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
              <p className="text-sm text-red-700 dark:text-red-400">
                Couldn't load exercises: {loadError}
              </p>
              <button
                onClick={() => {
                  setLoadError(null)
                  setExercises(null)
                  loadExercises()
                    .then(setExercises)
                    .catch((err: unknown) =>
                      setLoadError(err instanceof Error ? err.message : 'Failed to load'),
                    )
                }}
                className="px-3 py-1.5 rounded-lg text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Retry
              </button>
            </div>
          )}

          {exercises === null && loadError === null && (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </>
          )}

          {exercises !== null && filtered.length === 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center space-y-2">
              {essentialsOnly ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No matches in Essentials.
                  </p>
                  <button
                    onClick={() => setEssentialsOnly(false)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Search all 800 exercises
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No exercises match. Try clearing filters.
                </p>
              )}
            </div>
          )}

          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              isActive={ex.id === selectedId}
              onClick={() => setSelectedId(ex.id)}
            />
          ))}
        </div>

        {/* Desktop side-pane */}
        {selected && (
          <div className="hidden md:block sticky top-[120px] self-start h-[calc(100vh-140px)]">
            <ExerciseDetail
              exercise={selected}
              onClose={() => setSelectedId(null)}
              history={history}
              inline
            />
          </div>
        )}
      </div>

      {/* Mobile modal */}
      {selected && (
        <div className="md:hidden">
          <ExerciseDetail
            exercise={selected}
            onClose={() => setSelectedId(null)}
            history={history}
          />
        </div>
      )}
    </div>
  )
}
