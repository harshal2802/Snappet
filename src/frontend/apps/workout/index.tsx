import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import Dashboard from './Dashboard'
import ExerciseBrowser from './ExerciseBrowser'
import HistoryView from './HistoryView'
import RoutineEditor from './RoutineEditor'
import RoutineList from './RoutineList'
import SettingsView from './SettingsView'
import WorkoutPlayer from './WorkoutPlayer'
import { loadExercises } from './data'
import { STARTER_ROUTINES } from './starters'
import { generateId } from './utils'
import type { Exercise, Routine, SetLog, WeightUnit, WorkoutSession } from './types'

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
  const [startersSeeded, setStartersSeeded] = useLocalStorage<boolean>(
    'snappet:workout:starters-seeded',
    false,
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
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-full sm:w-fit overflow-x-auto">
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
      )}
      {tab === 'browse' && (
        <ExerciseBrowser
          resetSignal={browseResetCounter}
          history={history}
          preferredUnit={preferredUnit}
          pendingExerciseId={pendingExerciseId}
          onConsumePending={() => setPendingExerciseId(null)}
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
          exercises={exercises}
          exerciseById={exerciseById}
          preferredUnit={preferredUnit}
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
}

function RoutinesView({
  routines,
  setRoutines,
  exercises,
  exerciseById,
  preferredUnit,
  onStartRoutine,
}: RoutinesViewProps) {
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
        preferredUnit={preferredUnit}
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
      onStart={onStartRoutine}
    />
  )
}
