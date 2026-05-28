import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import ExerciseCard from './ExerciseCard'
import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseFiltersSerialized,
  ExerciseLevel,
  Muscle,
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
  'body only', 'dumbbell', 'barbell', 'cable', 'machine', 'kettlebells',
  'bands', 'medicine ball', 'exercise ball', 'foam roll', 'e-z curl bar', 'other',
]
const ALL_MUSCLES: Muscle[] = [
  'abdominals', 'biceps', 'triceps', 'chest', 'shoulders', 'forearms',
  'lats', 'middle back', 'lower back', 'traps', 'neck', 'quadriceps',
  'hamstrings', 'glutes', 'calves', 'abductors', 'adductors',
]

const EMPTY_FILTERS: ExerciseFiltersSerialized = {
  categories: [], levels: [], equipment: [], muscles: [],
}

const PILL_BASE =
  'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const PILL_ACTIVE = 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
const PILL_INACTIVE =
  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

function matchesFilters(ex: Exercise, f: ExerciseFiltersSerialized): boolean {
  if (f.categories.length && !f.categories.includes(ex.category)) return false
  if (f.levels.length && !f.levels.includes(ex.level)) return false
  if (f.equipment.length && !f.equipment.includes(ex.equipment)) return false
  if (f.muscles.length) {
    const all = new Set<Muscle>([...ex.primaryMuscles, ...ex.secondaryMuscles])
    if (!f.muscles.some((m) => all.has(m))) return false
  }
  return true
}

interface ExercisePickerProps {
  exercises: Exercise[]
  alreadySelectedIds?: Set<string>
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExercisePicker({
  exercises,
  alreadySelectedIds,
  onPick,
  onClose,
}: ExercisePickerProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useLocalStorage<ExerciseFiltersSerialized>(
    'snappet:workout:picker-filters',
    EMPTY_FILTERS,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggle<T extends keyof ExerciseFiltersSerialized>(
    key: T,
    value: ExerciseFiltersSerialized[T][number],
  ) {
    setFilters((prev) => {
      const cur = prev[key] as Array<typeof value>
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      return { ...prev, [key]: next }
    })
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return exercises.filter((ex) => {
      if (term && !ex.name.toLowerCase().includes(term)) return false
      return matchesFilters(ex, filters)
    })
  }, [exercises, search, filters])

  const activeCount =
    filters.categories.length + filters.levels.length + filters.equipment.length + filters.muscles.length

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 sm:rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col max-h-screen sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Pick exercise</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
          >
            ✕
          </button>
        </div>

        {/* Search + filter toggle */}
        <div className="px-3 py-2 space-y-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises…"
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Filters
              {activeCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-semibold">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
          {filtersOpen && (
            <div className="space-y-2">
              {([['Category', ALL_CATEGORIES, 'categories'],
                  ['Level', ALL_LEVELS, 'levels'],
                  ['Equipment', ALL_EQUIPMENT, 'equipment'],
                  ['Muscle', ALL_MUSCLES, 'muscles']] as const).map(([label, options, key]) => (
                <div key={key}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(options as readonly string[]).map((opt) => {
                      const active = (filters[key] as string[]).includes(opt)
                      return (
                        <button
                          key={opt}
                          onClick={() =>
                            toggle(
                              key,
                              opt as ExerciseFiltersSerialized[typeof key][number],
                            )
                          }
                          aria-pressed={active}
                          className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_INACTIVE}`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              No exercises match.
            </p>
          ) : (
            filtered.map((ex) => {
              const already = alreadySelectedIds?.has(ex.id) ?? false
              return (
                <div key={ex.id} className="relative">
                  <ExerciseCard exercise={ex} onClick={() => onPick(ex)} />
                  {already && (
                    <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold pointer-events-none">
                      ✓
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
