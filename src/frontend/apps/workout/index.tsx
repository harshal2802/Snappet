import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import ExerciseBrowser from './ExerciseBrowser'
import RoutineEditor from './RoutineEditor'
import RoutineList from './RoutineList'
import { loadExercises } from './data'
import { STARTER_ROUTINES } from './starters'
import { generateId } from './utils'
import type { Exercise, Routine } from './types'

type Tab = 'browse' | 'routines'

const TAB_BTN_BASE =
  'flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const TAB_BTN_ACTIVE = 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
const TAB_BTN_INACTIVE = 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

export default function Workout() {
  const [tab, setTab] = useLocalStorage<Tab>('snappet:workout:tab', 'browse')
  const [routines, setRoutines] = useLocalStorage<Routine[]>('snappet:workout:routines', [])
  const [startersSeeded, setStartersSeeded] = useLocalStorage<boolean>(
    'snappet:workout:starters-seeded',
    false,
  )

  // One-shot seed of starter routines on first ever load.
  useEffect(() => {
    if (!startersSeeded) {
      setRoutines((prev) => [...STARTER_ROUTINES, ...prev])
      setStartersSeeded(true)
    }
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
  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  // Reset counter for Browse tab — ExerciseBrowser watches this and clears
  // its search/filters/selection when it increments.
  const [browseResetCounter, setBrowseResetCounter] = useState(0)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Workout</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse 800+ exercises and build your own routines.
          </p>
        </div>
        {tab === 'browse' && (
          <button
            onClick={() => setBrowseResetCounter((c) => c + 1)}
            className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-full sm:w-fit">
        <button
          onClick={() => setTab('browse')}
          aria-pressed={tab === 'browse'}
          className={`${TAB_BTN_BASE} ${tab === 'browse' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          Browse
        </button>
        <button
          onClick={() => setTab('routines')}
          aria-pressed={tab === 'routines'}
          className={`${TAB_BTN_BASE} ${tab === 'routines' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          Routines
          {routines.length > 0 && (
            <span className="ml-1 text-gray-400 dark:text-gray-500">({routines.length})</span>
          )}
        </button>
      </div>

      {/* Body */}
      {tab === 'browse' ? (
        <ExerciseBrowser resetSignal={browseResetCounter} />
      ) : (
        <RoutinesView
          routines={routines}
          setRoutines={setRoutines}
          exercises={exercises}
          exerciseById={exerciseById}
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
}

function RoutinesView({ routines, setRoutines, exercises, exerciseById }: RoutinesViewProps) {
  type EditTarget = null | 'new' | string
  const [editingId, setEditingId] = useState<EditTarget>(null)

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
    setRoutines((prev) => prev.filter((r) => r.id !== id))
    if (editingId === id) setEditingId(null)
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
        onSave={handleSave}
        onCancel={() => setEditingId(null)}
        onDelete={editingRoutine ? handleDelete : undefined}
      />
    )
  }

  return (
    <RoutineList
      routines={routines}
      exerciseById={exerciseById}
      onNew={() => setEditingId('new')}
      onEdit={(id) => setEditingId(id)}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      // onStart deliberately omitted in Phase 2 — Phase 3 will wire it.
    />
  )
}
