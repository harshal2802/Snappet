import { useEffect, useState } from 'react'
import {
  ALL_CATEGORIES,
  ALL_EQUIPMENT,
  ALL_FORCE,
  ALL_LEVELS,
  ALL_MECHANIC,
  ALL_MUSCLES,
  makeCustomExercise,
} from './customExercises'
import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseLevel,
  Force,
  Mechanic,
  Muscle,
} from './types'

interface ExerciseEditorProps {
  /** null = creating new; an Exercise = editing that custom exercise. */
  exercise: Exercise | null
  /** Pre-filled draft when "Customize"-ing a DB exercise (already run through
   *  makeCustomExercise). Takes precedence over `exercise === null`. */
  seed?: Exercise
  onSave: (exercise: Exercise) => void
  onCancel: () => void
  /** Only provided when editing an existing custom exercise. */
  onDelete?: (id: string) => void
}

const PILL_BASE =
  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[44px] sm:min-h-0 flex items-center'
const PILL_ACTIVE = 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
const PILL_INACTIVE =
  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

const SECTION_LABEL =
  'text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5'

function SingleSelectRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  noneLabel,
}: {
  label: string
  options: readonly T[]
  selected: T | null
  onSelect: (value: T | null) => void
  /** When set, renders a "None" chip mapping to null. */
  noneLabel?: string
}) {
  return (
    <div>
      <p className={SECTION_LABEL}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {noneLabel !== undefined && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-pressed={selected === null}
            className={`${PILL_BASE} ${selected === null ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            {noneLabel}
          </button>
        )}
        {options.map((opt) => {
          const active = selected === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(active && noneLabel !== undefined ? null : opt)}
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

function MultiSelectRow<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: readonly T[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div>
      <p className={SECTION_LABEL}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
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

export default function ExerciseEditor({
  exercise,
  seed,
  onSave,
  onCancel,
  onDelete,
}: ExerciseEditorProps) {
  // Stable base — generated once. Editing an existing custom keeps its id;
  // "Customize" uses the seed draft; "+ New" gets a fresh blank.
  const [base] = useState<Exercise>(() => exercise ?? seed ?? makeCustomExercise())

  const [name, setName] = useState(base.name)
  const [category, setCategory] = useState<ExerciseCategory>(base.category)
  const [level, setLevel] = useState<ExerciseLevel>(base.level)
  const [equipment, setEquipment] = useState<Equipment>(base.equipment)
  const [force, setForce] = useState<Force>(base.force)
  const [mechanic, setMechanic] = useState<Mechanic>(base.mechanic)
  const [primaryMuscles, setPrimaryMuscles] = useState<Muscle[]>(base.primaryMuscles)
  const [secondaryMuscles, setSecondaryMuscles] = useState<Muscle[]>(base.secondaryMuscles)
  const [instructions, setInstructions] = useState<string[]>(
    base.instructions.length > 0 ? base.instructions : [''],
  )

  const isEditingExisting = exercise !== null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toggleMuscle(list: Muscle[], setList: (m: Muscle[]) => void, m: Muscle) {
    setList(list.includes(m) ? list.filter((x) => x !== m) : [...list, m])
  }

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0

  function handleSave() {
    if (!canSave) return
    const saved: Exercise = {
      id: base.id,
      name: trimmedName,
      force,
      level,
      mechanic,
      equipment,
      primaryMuscles,
      secondaryMuscles,
      instructions: instructions.map((s) => s.trim()).filter((s) => s.length > 0),
      category,
      images: base.images, // always [] for custom in v1
      isCustom: true,
    }
    onSave(saved)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 sm:rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col max-h-screen sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isEditingExisting ? 'Edit exercise' : 'New exercise'}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <p className={SECTION_LABEL}>Name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gym Sled Push"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <SingleSelectRow
            label="Category"
            options={ALL_CATEGORIES}
            selected={category}
            onSelect={(v) => v && setCategory(v)}
          />
          <SingleSelectRow
            label="Level"
            options={ALL_LEVELS}
            selected={level}
            onSelect={(v) => v && setLevel(v)}
          />
          <SingleSelectRow
            label="Equipment"
            options={ALL_EQUIPMENT}
            selected={equipment}
            onSelect={(v) => v && setEquipment(v)}
          />
          <SingleSelectRow
            label="Force"
            options={ALL_FORCE}
            selected={force}
            onSelect={setForce}
            noneLabel="None"
          />
          <SingleSelectRow
            label="Mechanic"
            options={ALL_MECHANIC}
            selected={mechanic}
            onSelect={setMechanic}
            noneLabel="None"
          />
          <MultiSelectRow
            label="Primary muscles"
            options={ALL_MUSCLES}
            selected={primaryMuscles}
            onToggle={(m) => toggleMuscle(primaryMuscles, setPrimaryMuscles, m)}
          />
          <MultiSelectRow
            label="Secondary muscles"
            options={ALL_MUSCLES}
            selected={secondaryMuscles}
            onToggle={(m) => toggleMuscle(secondaryMuscles, setSecondaryMuscles, m)}
          />

          {/* Instructions */}
          <div>
            <p className={SECTION_LABEL}>Instructions</p>
            <div className="space-y-2">
              {instructions.map((step, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-4 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) =>
                      setInstructions((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && i === instructions.length - 1 && step.trim()) {
                        e.preventDefault()
                        setInstructions((prev) => [...prev, ''])
                      }
                    }}
                    placeholder={`Step ${i + 1}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {instructions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setInstructions((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove step ${i + 1}`}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInstructions((prev) => [...prev, ''])}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-0.5"
              >
                + Add step
              </button>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
          {isEditingExisting && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(base.id)}
              className="px-3 py-2 rounded-lg text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
