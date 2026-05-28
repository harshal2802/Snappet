import { useMemo, useState } from 'react'
import ExerciseImage from './ExerciseImage'
import ExercisePicker from './ExercisePicker'
import { generateId } from './utils'
import type { Exercise, Routine, RoutineExercise, WeightUnit } from './types'

interface RoutineEditorProps {
  /** null = creating new; otherwise editing an existing routine. */
  routine: Routine | null
  exercises: Exercise[]
  exerciseById: Map<string, Exercise>
  onSave: (routine: Routine) => void
  onCancel: () => void
  onDelete?: (routineId: string) => void
}

export default function RoutineEditor({
  routine,
  exercises,
  exerciseById,
  onSave,
  onCancel,
  onDelete,
}: RoutineEditorProps) {
  const isNew = routine === null

  // Local draft state
  const [name, setName] = useState<string>(routine?.name ?? '')
  const [items, setItems] = useState<RoutineExercise[]>(
    routine ? routine.exercises.map((e) => ({ ...e })) : [],
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  // Per-row UI state — which rows have weight/notes/rename expanded
  const [weightOpen, setWeightOpen] = useState<Set<number>>(new Set())
  const [notesOpen, setNotesOpen] = useState<Set<number>>(new Set())
  const [renameOpen, setRenameOpen] = useState<Set<number>>(new Set())

  const canSave = name.trim().length > 0 && items.length > 0

  const alreadySelectedIds = useMemo(
    () => new Set(items.map((i) => i.exerciseId)),
    [items],
  )

  function handlePick(ex: Exercise) {
    setItems((prev) => [
      ...prev,
      { exerciseId: ex.id, sets: 3, reps: '10', restSeconds: 60 },
    ])
    setPickerOpen(false)
  }

  function updateItem(idx: number, patch: Partial<RoutineExercise>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
    // Tidy up associated UI state
    const remap = (s: Set<number>) => {
      const next = new Set<number>()
      s.forEach((i) => {
        if (i < idx) next.add(i)
        else if (i > idx) next.add(i - 1)
      })
      return next
    }
    setWeightOpen(remap)
    setNotesOpen(remap)
    setRenameOpen(remap)
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<number>>>, idx: number) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function handleSave() {
    if (!canSave) return
    const now = Date.now()
    const saved: Routine = {
      id: routine?.id ?? generateId(),
      name: name.trim(),
      exercises: items,
      createdAt: routine?.createdAt ?? now,
      updatedAt: now,
      // isStarter intentionally omitted; once edited, it loses the starter pill
    }
    onSave(saved)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:underline"
        >
          ← Back
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
          {isNew ? 'New Routine' : 'Edit Routine'}
        </h2>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Save
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Routine"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Exercises */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Exercises ({items.length})
        </h3>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={exercises.length === 0}
          title={exercises.length === 0 ? 'Loading exercises…' : undefined}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {exercises.length === 0 ? 'Loading…' : '+ Add exercise'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No exercises yet. Tap "+ Add exercise" to start.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => {
            const ex = exerciseById.get(it.exerciseId)
            const showWeight = weightOpen.has(idx)
            const showNotes = notesOpen.has(idx)
            const showRename = renameOpen.has(idx)
            const isFirst = idx === 0
            const isLast = idx === items.length - 1
            const displayedName = it.displayName?.trim() || ex?.name || `Unknown (${it.exerciseId})`
            const isRenamed = (it.displayName?.trim().length ?? 0) > 0
            return (
              <li
                key={`${it.exerciseId}-${idx}`}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2"
              >
                {/* Top row: thumb + name + reorder + remove */}
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {ex?.images[0] && (
                      <ExerciseImage path={ex.images[0]} alt={ex.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {displayedName}
                    </p>
                    {isRenamed && ex?.name && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                        {ex.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => moveItem(idx, -1)}
                      disabled={isFirst}
                      aria-label="Move up"
                      className="w-9 h-9 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveItem(idx, 1)}
                      disabled={isLast}
                      aria-label="Move down"
                      className="w-9 h-9 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => toggleSet(setRenameOpen, idx)}
                      aria-label="Rename exercise"
                      aria-pressed={showRename}
                      className={`w-9 h-9 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isRenamed
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      ✏
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      aria-label="Remove"
                      className="w-9 h-9 rounded text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Rename (collapsible) */}
                {showRename && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2 space-y-1.5">
                    <label className="block text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Custom name (shown during workout & history)
                    </label>
                    <input
                      type="text"
                      value={it.displayName ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        updateItem(idx, { displayName: v === '' ? undefined : v })
                      }}
                      placeholder={ex?.name ?? 'Custom name'}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        Original: {ex?.name ?? it.exerciseId}
                      </p>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => updateItem(idx, { displayName: undefined })}
                          disabled={!isRenamed}
                          className="text-[11px] text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-default focus:outline-none focus-visible:underline"
                        >
                          Reset to original
                        </button>
                        <button
                          onClick={() => toggleSet(setRenameOpen, idx)}
                          className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus-visible:underline"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sets / Reps / Rest */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                      Sets
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={it.sets}
                      onChange={(e) =>
                        updateItem(idx, {
                          sets: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                      Reps
                    </label>
                    <input
                      type="text"
                      value={it.reps}
                      onChange={(e) => updateItem(idx, { reps: e.target.value })}
                      placeholder="e.g. 10, 8-12, 30s"
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                      Rest (s)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={it.restSeconds}
                      onChange={(e) =>
                        updateItem(idx, {
                          restSeconds: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Weight (collapsible) */}
                {!showWeight && (
                  <button
                    onClick={() => toggleSet(setWeightOpen, idx)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:underline"
                  >
                    + Add weight
                  </button>
                )}
                {showWeight && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                        Weight
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        value={it.weight ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          updateItem(idx, {
                            weight: v === '' ? undefined : Math.max(0, Number(v)),
                          })
                        }}
                        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                      {(['kg', 'lb'] as WeightUnit[]).map((u) => {
                        const active = (it.weightUnit ?? 'kg') === u
                        return (
                          <button
                            key={u}
                            onClick={() => updateItem(idx, { weightUnit: u })}
                            aria-pressed={active}
                            className={`px-2 py-1.5 text-xs font-medium ${
                              active
                                ? 'bg-blue-600 dark:bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                            } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                          >
                            {u}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => {
                        updateItem(idx, { weight: undefined, weightUnit: undefined })
                        toggleSet(setWeightOpen, idx)
                      }}
                      aria-label="Remove weight"
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-lg px-1 focus:outline-none focus-visible:underline"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Notes (collapsible) */}
                {!showNotes && (
                  <button
                    onClick={() => toggleSet(setNotesOpen, idx)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:underline"
                  >
                    + Add note
                  </button>
                )}
                {showNotes && (
                  <textarea
                    value={it.notes ?? ''}
                    onChange={(e) => updateItem(idx, { notes: e.target.value || undefined })}
                    rows={2}
                    placeholder="Form cue, tempo, etc."
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Delete (only when editing an existing routine) */}
      {!isNew && onDelete && routine && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              if (confirm(`Delete "${routine.name}"?`)) onDelete(routine.id)
            }}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus-visible:underline"
          >
            Delete routine
          </button>
        </div>
      )}

      {/* Picker */}
      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          alreadySelectedIds={alreadySelectedIds}
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
