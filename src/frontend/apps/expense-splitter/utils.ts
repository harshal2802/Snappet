import type { Expense, Person } from './types'

export function formatCurrency(value: number): string {
  return '$' + value.toFixed(2)
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function calculateOwed(
  expenses: Expense[],
  people: Person[]
): Record<string, number> {
  const owed: Record<string, number> = {}
  people.forEach((p) => {
    owed[p.id] = 0
  })

  expenses.forEach((expense) => {
    if (expense.total <= 0) return

    if (expense.splitMode === 'equal') {
      const assigned = expense.assignedTo.filter((id) => id in owed)
      if (assigned.length === 0) return
      const perPerson = expense.total / assigned.length
      assigned.forEach((personId) => {
        owed[personId] += perPerson
      })
    } else {
      expense.shares.forEach((share) => {
        if (share.personId in owed) {
          owed[share.personId] += share.amount
        }
      })
    }
  })

  return owed
}

export function sharesTotal(shares: Expense['shares']): number {
  return shares.reduce((sum, s) => sum + s.amount, 0)
}
