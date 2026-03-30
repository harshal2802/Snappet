export interface Person {
  id: string
  name: string
}

export interface ExpenseShare {
  personId: string
  amount: number
}

export interface Expense {
  id: string
  description: string
  total: number
  splitMode: 'equal' | 'custom'
  shares: ExpenseShare[]   // one entry per person; used in custom mode
  assignedTo: string[]     // personIds included in equal split
}
