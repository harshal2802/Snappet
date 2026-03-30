import { useState, useRef } from 'react'
import type { Person, Expense } from './types'
import ExpenseCard from './ExpenseCard'
import { calculateOwed, formatCurrency, generateId } from './utils'
import { useLocalStorage } from '../../hooks/useLocalStorage'

function makePerson(name: string): Person {
  return { id: generateId(), name }
}

function makeExpense(people: Person[]): Expense {
  return {
    id: generateId(),
    description: '',
    total: 0,
    splitMode: 'equal',
    shares: [],
    assignedTo: people.map((p) => p.id),
  }
}

function makeDefaultState() {
  const defaultPeople = [makePerson('Person 1'), makePerson('Person 2')]
  return { people: defaultPeople, expenses: [makeExpense(defaultPeople)] }
}

export default function ExpenseSplitter() {
  const [people, setPeople] = useLocalStorage<Person[]>('snappet:expense:people', makeDefaultState().people)
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('snappet:expense:expenses', makeDefaultState().expenses)
  const [nameInput, setNameInput] = useState('')
  const [removeError, setRemoveError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  function handleReset() {
    const fresh = makeDefaultState()
    setPeople(fresh.people)
    setExpenses(fresh.expenses)
    setNameInput('')
    setRemoveError(null)
  }

  // Derived totals
  const owed = calculateOwed(expenses, people)
  const grandTotal = Object.values(owed).reduce((sum, v) => sum + v, 0)

  function addPerson() {
    const name = nameInput.trim()
    if (!name) return
    const person = makePerson(name)
    setPeople((prev) => [...prev, person])
    // Add them to all existing equal-split expenses
    setExpenses((prev) =>
      prev.map((exp) =>
        exp.splitMode === 'equal'
          ? { ...exp, assignedTo: [...exp.assignedTo, person.id] }
          : {
              ...exp,
              shares: [...exp.shares, { personId: person.id, amount: 0 }],
            }
      )
    )
    setNameInput('')
    nameInputRef.current?.focus()
  }

  function removePerson(id: string) {
    if (people.length <= 2) {
      setRemoveError('You need at least 2 people.')
      setTimeout(() => setRemoveError(null), 3000)
      return
    }
    setPeople((prev) => prev.filter((p) => p.id !== id))
    setExpenses((prev) =>
      prev.map((exp) => ({
        ...exp,
        assignedTo: exp.assignedTo.filter((pid) => pid !== id),
        shares: exp.shares.filter((s) => s.personId !== id),
      }))
    )
  }

  function addExpense() {
    setExpenses((prev) => [...prev, makeExpense(people)])
  }

  function updateExpense(id: string, updated: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  function handleNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') addPerson()
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Expense Splitter
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Split bills across a group with custom amounts.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ↺ Reset
        </button>
      </div>

      {/* People */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          People
        </h2>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <span
              key={person.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200"
            >
              {person.name}
              <button
                onClick={() => removePerson(person.id)}
                aria-label={`Remove ${person.name}`}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full"
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        {removeError && (
          <p className="text-xs text-red-600 dark:text-red-400">{removeError}</p>
        )}

        <div className="flex gap-2">
          <input
            ref={nameInputRef}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleNameKey}
            placeholder="Add a person…"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
          <button
            onClick={addPerson}
            disabled={!nameInput.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Add
          </button>
        </div>
      </section>

      {/* Expenses */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide px-1">
          Expenses
        </h2>
        {expenses.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            No expenses yet — add one below.
          </p>
        )}
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            people={people}
            onChange={(updated) => updateExpense(expense.id, updated)}
            onRemove={() => removeExpense(expense.id)}
          />
        ))}
        <button
          onClick={addExpense}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          + Add expense
        </button>
      </section>

      {/* Summary */}
      <section className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-5 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Summary
        </h2>
        {grandTotal === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Add expenses above to see the breakdown.
          </p>
        ) : (
          <div className="space-y-2">
            {people.map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {person.name}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(owed[person.id] ?? 0)}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between text-sm font-bold">
              <span className="text-gray-900 dark:text-gray-100">Total</span>
              <span className="text-blue-600 dark:text-blue-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
