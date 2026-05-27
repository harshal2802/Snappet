import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

interface Counter {
  id: string
  name: string
  value: number
}

function generateId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function makeDefaultCounter(): Counter {
  return { id: generateId(), name: 'Counter', value: 0 }
}

function vibrate(ms: number): void {
  // Optional chaining: no-op on iOS Safari and other browsers without the API.
  navigator.vibrate?.(ms)
}

export default function TallyCounter() {
  const [counters, setCounters] = useLocalStorage<Counter[]>(
    'snappet:tally-counter:counters',
    [makeDefaultCounter()],
  )
  const [activeId, setActiveId] = useLocalStorage<string>(
    'snappet:tally-counter:activeId',
    counters[0]?.id ?? '',
  )
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Defensive: ensure there is always at least one counter and the activeId
  // refers to one that exists. Guards against bad persisted state.
  useEffect(() => {
    if (counters.length === 0) {
      const fresh = makeDefaultCounter()
      setCounters([fresh])
      setActiveId(fresh.id)
      return
    }
    if (!counters.some((c) => c.id === activeId)) {
      setActiveId(counters[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counters, activeId])

  const activeCounter = useMemo<Counter>(
    () => counters.find((c) => c.id === activeId) ?? counters[0] ?? makeDefaultCounter(),
    [counters, activeId],
  )

  function updateActive(updater: (c: Counter) => Counter) {
    setCounters((prev) => prev.map((c) => (c.id === activeCounter.id ? updater(c) : c)))
  }

  function handleIncrement() {
    vibrate(10)
    updateActive((c) => ({ ...c, value: c.value + 1 }))
  }

  function handleDecrement() {
    if (activeCounter.value <= 0) return
    vibrate(10)
    updateActive((c) => ({ ...c, value: Math.max(0, c.value - 1) }))
  }

  function handleResetActive() {
    updateActive((c) => ({ ...c, value: 0 }))
  }

  function handleResetAll() {
    setCounters((prev) => prev.map((c) => ({ ...c, value: 0 })))
  }

  function startRename() {
    setNameDraft(activeCounter.name)
    setRenaming(true)
    // Focus on next tick once the input mounts
    window.setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function commitRename() {
    const next = nameDraft.trim()
    if (next.length > 0) {
      updateActive((c) => ({ ...c, name: next }))
    }
    setRenaming(false)
  }

  function handleNameKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setRenaming(false)
    }
  }

  function addCounter() {
    const nextIndex = counters.length + 1
    const fresh: Counter = { id: generateId(), name: `Counter ${nextIndex}`, value: 0 }
    setCounters((prev) => [...prev, fresh])
    setActiveId(fresh.id)
  }

  function requestDelete(id: string) {
    if (counters.length <= 1) return
    setConfirmDeleteId(id)
  }

  function confirmDelete() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setCounters((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) return [makeDefaultCounter()]
      return next
    })
    if (activeId === id) {
      const fallback = counters.find((c) => c.id !== id)
      if (fallback) setActiveId(fallback.id)
    }
    setConfirmDeleteId(null)
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Tally Counter
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tap to count anything, one-thumb style.
          </p>
        </div>
        <button
          onClick={handleResetActive}
          className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ↺ Reset
        </button>
      </div>

      {/* Active counter card */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-4">
        {/* Editable name */}
        <div className="text-center">
          {renaming ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleNameKey}
              maxLength={40}
              aria-label="Counter name"
              className="text-center text-lg font-medium px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <button
              onClick={startRename}
              className="text-lg font-medium text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Rename counter ${activeCounter.name}`}
            >
              {activeCounter.name}
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                ✎
              </span>
            </button>
          )}
        </div>

        {/* Big number */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="text-center text-7xl sm:text-8xl font-bold text-gray-900 dark:text-gray-100 tabular-nums py-6 select-none"
        >
          {activeCounter.value.toLocaleString()}
        </div>

        {/* Giant + button */}
        <button
          onClick={handleIncrement}
          aria-label="Increment counter"
          className="w-full h-[40vh] min-h-[200px] rounded-3xl bg-blue-600 dark:bg-blue-500 text-white text-7xl sm:text-8xl font-bold shadow-md hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 transition-colors select-none focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-700"
        >
          +
        </button>

        {/* − button */}
        <button
          onClick={handleDecrement}
          disabled={activeCounter.value <= 0}
          aria-label="Decrement counter"
          className="w-full h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-3xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          −
        </button>

        {/* Reset to 0 link */}
        <div className="text-center">
          <button
            onClick={handleResetActive}
            disabled={activeCounter.value === 0}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded px-2 py-1"
          >
            Reset to 0
          </button>
        </div>
      </section>

      {/* Counter pills */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
          Counters
        </h2>
        <div className="flex flex-wrap gap-2">
          {counters.map((c) => {
            const isActive = c.id === activeId
            return (
              <div
                key={c.id}
                className={`flex items-center gap-1 rounded-full text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <button
                  onClick={() => setActiveId(c.id)}
                  className="pl-3 pr-1 py-1.5 rounded-l-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="font-medium">{c.name}</span>
                  <span
                    className={`ml-1.5 text-xs tabular-nums ${
                      isActive
                        ? 'text-blue-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {c.value.toLocaleString()}
                  </span>
                </button>
                {counters.length > 1 && (
                  <button
                    onClick={() => requestDelete(c.id)}
                    aria-label={`Delete counter ${c.name}`}
                    className={`pr-2 pl-1 py-1.5 rounded-r-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                      isActive
                        ? 'text-blue-100 hover:text-white'
                        : 'text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          <button
            onClick={addCounter}
            aria-label="Add counter"
            className="px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            + New
          </button>
        </div>
      </section>

      {/* Reset all */}
      <div className="text-center pt-2">
        <button
          onClick={handleResetAll}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded px-2 py-1"
        >
          Reset all counters to 0
        </button>
      </div>

      {/* Delete confirm */}
      {confirmDeleteId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete counter"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Delete counter?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This will permanently remove{' '}
              <span className="font-medium">
                {counters.find((c) => c.id === confirmDeleteId)?.name ?? ''}
              </span>{' '}
              and its current count. This can't be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
