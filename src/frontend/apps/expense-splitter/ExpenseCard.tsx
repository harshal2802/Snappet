import type { Expense, Person } from './types'
import { formatCurrency, sharesTotal } from './utils'

interface ExpenseCardProps {
  expense: Expense
  people: Person[]
  onChange: (updated: Expense) => void
  onRemove: () => void
}

export default function ExpenseCard({
  expense,
  people,
  onChange,
  onRemove,
}: ExpenseCardProps) {
  const assignedCount = expense.assignedTo.length
  const equalWarning =
    expense.splitMode === 'equal' && assignedCount === 0

  const assigned = sharesTotal(expense.shares)
  const diff = expense.total - assigned
  const isBalanced = Math.abs(diff) < 0.01

  function setDescription(value: string) {
    onChange({ ...expense, description: value })
  }

  function setTotal(value: string) {
    const num = parseFloat(value)
    onChange({ ...expense, total: isNaN(num) ? 0 : Math.max(0, num) })
  }

  function setSplitMode(mode: 'equal' | 'custom') {
    if (mode === 'custom') {
      // Pre-populate shares with equal amounts for assigned people, 0 for others
      const base =
        expense.assignedTo.length > 0
          ? expense.total / expense.assignedTo.length
          : 0
      const shares = people.map((p) => ({
        personId: p.id,
        amount: expense.assignedTo.includes(p.id)
          ? parseFloat(base.toFixed(2))
          : 0,
      }))
      onChange({ ...expense, splitMode: 'custom', shares })
    } else {
      onChange({ ...expense, splitMode: 'equal' })
    }
  }

  function toggleAssigned(personId: string) {
    const already = expense.assignedTo.includes(personId)
    const updated = already
      ? expense.assignedTo.filter((id) => id !== personId)
      : [...expense.assignedTo, personId]
    onChange({ ...expense, assignedTo: updated })
  }

  function setShare(personId: string, value: string) {
    const num = parseFloat(value)
    const amount = isNaN(num) ? 0 : Math.max(0, num)
    const shares = expense.shares.map((s) =>
      s.personId === personId ? { ...s, amount } : s
    )
    // Ensure entry exists for this person
    if (!shares.find((s) => s.personId === personId)) {
      shares.push({ personId, amount })
    }
    onChange({ ...expense, shares })
  }

  function getShare(personId: string): number {
    return expense.shares.find((s) => s.personId === personId)?.amount ?? 0
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={expense.description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Expense name (e.g. Dinner)"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
            $
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={expense.total === 0 ? '' : expense.total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0.00"
            className="w-28 pl-6 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove expense"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ✕
        </button>
      </div>

      {/* Split mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg w-fit">
        {(['equal', 'custom'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSplitMode(mode)}
            aria-pressed={expense.splitMode === mode}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 capitalize ${
              expense.splitMode === mode
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Equal split: checkboxes */}
      {expense.splitMode === 'equal' && (
        <div className="space-y-1.5">
          {people.map((person) => (
            <label
              key={person.id}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={expense.assignedTo.includes(person.id)}
                onChange={() => toggleAssigned(person.id)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                {person.name}
              </span>
              {expense.assignedTo.includes(person.id) &&
                assignedCount > 0 &&
                expense.total > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatCurrency(expense.total / assignedCount)}
                  </span>
                )}
            </label>
          ))}
          {equalWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚠ Select at least one person for this expense.
            </p>
          )}
        </div>
      )}

      {/* Custom split: amount inputs */}
      {expense.splitMode === 'custom' && (
        <div className="space-y-2">
          {people.map((person) => (
            <div key={person.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                {person.name}
              </span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={getShare(person.id) === 0 ? '' : getShare(person.id)}
                  onChange={(e) => setShare(person.id, e.target.value)}
                  placeholder="0.00"
                  className="w-24 pl-6 pr-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
          ))}

          {/* Balance indicator */}
          <div
            className={`flex items-center justify-between text-xs font-medium pt-1 border-t ${
              isBalanced
                ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            }`}
          >
            <span>{isBalanced ? '✓ Balanced' : diff > 0 ? `Short by ${formatCurrency(diff)}` : `Over by ${formatCurrency(Math.abs(diff))}`}</span>
            <span>
              {formatCurrency(assigned)} / {formatCurrency(expense.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
