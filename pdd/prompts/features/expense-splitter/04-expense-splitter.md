# Prompt: Expense Splitter

**File**: pdd/prompts/features/expense-splitter/04-expense-splitter.md
**Created**: 2026-03-30
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Expense Splitter mini-app at `/expense-splitter`. It lets a group of people add multiple expense items and see exactly what each person owes — supporting both equal splits and custom per-person amounts per expense.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy, mobile-first), React Router v6, Vite. No new dependencies.

**Conventions**:
- Functional components, no class components
- Tailwind utility classes only — no inline styles
- No `any` — all types explicit
- Files go in `src/frontend/apps/expense-splitter/`
- Default export from `index.tsx`

## Task

Build an Expense Splitter mini-app where users add named people and multiple expense items, assign each expense to specific people (equally or with custom amounts), and see a summary of what each person owes.

## Input

Fresh folder `src/frontend/apps/expense-splitter/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. Types — `src/frontend/apps/expense-splitter/types.ts`

```ts
interface Person {
  id: string      // nanoid-style: Math.random().toString(36).slice(2, 9)
  name: string
}

interface ExpenseShare {
  personId: string
  amount: number   // custom amount; for equal split this is computed, not stored
}

interface Expense {
  id: string
  description: string
  total: number
  splitMode: 'equal' | 'custom'
  shares: ExpenseShare[]   // only used when splitMode === 'custom'
  assignedTo: string[]     // personIds included in this expense
}
```

### 2. `src/frontend/apps/expense-splitter/index.tsx`

Top-level component managing all state. Structure:

**People section**:
- Horizontal chip list of added people (name + remove ✕ button)
- "Add person" inline input + Add button (or Enter to submit)
- Minimum 2 people enforced — show error if user tries to remove below 2
- Default state: two people named "Person 1" and "Person 2"

**Expenses section**:
- List of expense cards (see `ExpenseCard` below)
- "Add expense" button appends a new blank expense
- Default state: one blank expense card open for editing

**Summary section** (always visible below expenses):
- Table or card list: one row per person showing their name + total amount owed
- Grand total row at bottom
- If no expenses, show a placeholder message

**State** (all in `index.tsx` via `useState`):
```ts
const [people, setPeople] = useState<Person[]>(...)
const [expenses, setExpenses] = useState<Expense[]>(...)
```

Summary totals are derived inline — no `useEffect`.

### 3. `src/frontend/apps/expense-splitter/ExpenseCard.tsx`

Props:
```ts
interface ExpenseCardProps {
  expense: Expense
  people: Person[]
  onChange: (updated: Expense) => void
  onRemove: () => void
}
```

Card layout:
- **Description** — inline text input (e.g. "Dinner", "Taxi")
- **Total amount** — numeric input, `$` prefix
- **Split mode toggle** — two buttons: `Equal` | `Custom`
- **People assignment**:
  - `Equal` mode: checkboxes for each person (checked = included in split). At least 1 must be checked.
  - `Custom` mode: each person gets a numeric input for their share. Show running total vs expense total (e.g. `$18.00 / $30.00`) — highlight in red if unbalanced, green if balanced.
- **Remove** — small ✕ button in the top-right corner

### 4. `src/frontend/apps/expense-splitter/utils.ts`

Pure functions only:

```ts
// Returns total owed per personId across all expenses
function calculateOwed(expenses: Expense[], people: Person[]): Record<string, number>

// For equal split: amount per person = expense.total / assignedTo.length
// For custom split: sum of shares[personId].amount
```

### 5. `src/frontend/router/routes.tsx` (updated)

Add the expense splitter route:
```ts
{
  path: '/expense-splitter',
  label: 'Expense Splitter',
  description: 'Split bills and expenses across a group with custom amounts.',
  category: 'Calculators',
  icon: '🧾',
  component: lazy(() => import('../apps/expense-splitter')),
}
```

## Constraints

- No new npm dependencies — use `Math.random().toString(36).slice(2, 9)` for IDs
- No inline styles — Tailwind only
- TypeScript strict — no `any`
- Summary totals derived inline — no `useEffect` for calculations
- Currency always 2 decimal places, `$` prefix
- Custom split: show visual balance indicator (red = unbalanced, green = balanced)
- Equal split: if no people are checked for an expense, show a validation warning on that card
- Removing a person removes them from all expense `assignedTo` arrays and `shares`
- Dark mode required on all elements
- Mobile-first: expense cards must be usable on 375px screen
