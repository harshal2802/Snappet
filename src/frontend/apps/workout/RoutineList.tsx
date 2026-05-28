import { useState } from 'react'
import ExerciseImage from './ExerciseImage'
import { getDisplayName } from './utils'
import type { Exercise, Routine } from './types'

interface RoutineListProps {
  routines: Routine[]
  exerciseById: Map<string, Exercise>
  onNew: () => void
  onEdit: (routineId: string) => void
  onDuplicate: (routineId: string) => void
  onDelete: (routineId: string) => void
  /** Phase 3 provides this; v2 hides the Start button when omitted. */
  onStart?: (routineId: string) => void
}

function estimateMinutes(r: Routine): number {
  // Active time per set ~30s + rest. Crude but useful.
  const seconds = r.exercises.reduce((acc, e) => acc + e.sets * (30 + e.restSeconds), 0)
  return Math.max(1, Math.round(seconds / 60))
}

export default function RoutineList({
  routines,
  exerciseById,
  onNew,
  onEdit,
  onDuplicate,
  onDelete,
  onStart,
}: RoutineListProps) {
  const [overflowOpenId, setOverflowOpenId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function closeOverflow() {
    setOverflowOpenId(null)
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {routines.length} routine{routines.length === 1 ? '' : 's'}
        </h2>
        <button
          onClick={onNew}
          className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          + New Routine
        </button>
      </div>

      {routines.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No routines yet. Create one to start planning workouts.
          </p>
          <button
            onClick={onNew}
            className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Create your first routine
          </button>
        </div>
      )}

      {/* List */}
      <ul className="space-y-2">
        {routines.map((r) => {
          const thumbs = r.exercises.slice(0, 3)
          const moreCount = Math.max(0, r.exercises.length - 3)
          const overflowOpen = overflowOpenId === r.id
          const confirmDelete = confirmDeleteId === r.id

          return (
            <li
              key={r.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {r.name}
                    </p>
                    {r.isStarter && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                        Starter
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {r.exercises.length} exercise{r.exercises.length === 1 ? '' : 's'} · ~
                    {estimateMinutes(r)} min
                  </p>
                  {/* Thumbnails */}
                  {thumbs.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      {thumbs.map((re, i) => {
                        const ex = exerciseById.get(re.exerciseId)
                        const label = getDisplayName(re, ex)
                        return (
                          <div
                            key={`${re.exerciseId}-${i}`}
                            className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden"
                            title={label}
                          >
                            {ex?.images[0] && (
                              <ExerciseImage
                                path={ex.images[0]}
                                alt={label}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        )
                      })}
                      {moreCount > 0 && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          +{moreCount} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {onStart && (
                    <button
                      onClick={() => onStart(r.id)}
                      className="px-3 py-1.5 rounded-lg bg-green-600 dark:bg-green-500 text-white text-xs font-semibold hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(r.id)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Edit
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => {
                        setOverflowOpenId(overflowOpen ? null : r.id)
                        setConfirmDeleteId(null)
                      }}
                      aria-label="More actions"
                      aria-haspopup="menu"
                      aria-expanded={overflowOpen}
                      className="w-8 h-8 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      ⋯
                    </button>
                    {overflowOpen && (
                      <>
                        {/* Backdrop to close on outside click */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={closeOverflow}
                          aria-hidden="true"
                        />
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1 z-20 min-w-[10rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
                        >
                          <button
                            role="menuitem"
                            onClick={() => {
                              closeOverflow()
                              onDuplicate(r.id)
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
                          >
                            Duplicate
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setConfirmDeleteId(r.id)
                              closeOverflow()
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-950/30"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline delete confirm */}
              {confirmDelete && (
                <div className="mt-3 p-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 flex items-center justify-between gap-2 text-xs">
                  <span className="text-red-700 dark:text-red-400">Delete "{r.name}"?</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDelete(r.id)
                        setConfirmDeleteId(null)
                      }}
                      className="px-2 py-1 rounded bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
