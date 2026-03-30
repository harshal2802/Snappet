# Prompt: Tip Calculator

**File**: pdd/prompts/features/tip-calculator/03-tip-calculator.md
**Created**: 2026-03-30
**Updated**: 2026-03-30
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. Each mini-app lives at its own route and does one thing well. This is the Tip Calculator mini-app at `/tip-calculator`.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy, mobile-first), React Router v6, Vite. No new dependencies.

**Conventions**:
- Functional components, no class components
- Tailwind utility classes only — no inline styles
- No `any` — all types explicit
- Files go in `src/frontend/apps/tip-calculator/`
- Default export from `index.tsx`

## Task

Build a Tip Calculator mini-app with two split modes: **Equal split** (one shared bill divided evenly) and **Per person** (each person enters their own bill amount). Show a live breakdown of tip and total for each scenario.

## Input

Fresh folder `src/frontend/apps/tip-calculator/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/apps/tip-calculator/index.tsx`

Single file component. All state lives here.

**Mode toggle** (shown at top, below the title):
- Two-button segmented control: `Equal split` | `Per person`
- `aria-pressed` on each button
- Switching Equal → Per Person: pre-populate person rows with equal amounts from current bill (`bill / people`)
- Switching Per Person → Equal: set bill input to sum of per-person amounts, set people count to number of rows

**Tip percentage controls** (shared across both modes):
- Preset pill buttons: `10%` `15%` `18%` `20%` `25%` + `Custom`
- Only one active at a time, `aria-pressed` on each
- Custom: shows an inline number input (`autoFocus`), clamped 0–100 on blur

---

**Equal split mode** — inputs card:
- **Bill amount** — `$` prefix, numeric input, placeholder `"0.00"`, min 0
- **Tip percentage** controls (as above)
- **Number of people** — stepper (− / + buttons) with numeric input in the middle, min 1, max 50; `−` button `disabled` + `opacity-50 cursor-not-allowed` at 1

**Equal split mode** — results card (blue tinted background):
- **Tip / person** — large display
- **Total / person** — largest, most prominent display
- Subtotals: tip total + grand total in muted smaller text

---

**Per person mode** — inputs card:
- **Bill per person** section: one row per person, each row has:
  - Name text input (placeholder `"Name"`, width ~7rem)
  - `$` prefix bill amount input (numeric, placeholder `"0.00"`)
  - Remove `✕` button — disabled and `opacity-30` when only 1 row remains
- `+ Add person` button — dashed border style, appends a new row
- **Tip percentage** controls (as above, below the person rows)

**Per person mode** — results card (blue tinted background):
- **Breakdown table**: one row per person showing name / Bill / Tip / Total columns
- Divider
- **Summary**: total bill, total tip (with % label), grand total (bold, blue)

---

**Shared behavior**:
- All results derived inline — no `useEffect` for calculations
- Currency: always 2 decimal places, `$` prefix via `formatCurrency(n: number): string`
- Results update instantly on every input change — no submit button
- `generateId()` using `Math.random().toString(36).slice(2, 9)` for person row IDs

**Layout**:
- `max-w-lg mx-auto`, single column, card-based
- Inputs card: `rounded-2xl border bg-white dark:bg-gray-800 p-6 shadow-sm`
- Results card: `rounded-2xl bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900 p-6 shadow-sm`
- Fully responsive — works on 375px mobile and 1440px desktop

### 2. `src/frontend/router/routes.tsx` (updated)

Add the tip calculator route:
```ts
{
  path: '/tip-calculator',
  label: 'Tip Calculator',
  description: 'Calculate tip and split the bill among friends.',
  category: 'Calculators',
  icon: '💰',
  component: lazy(() => import('../apps/tip-calculator')),
}
```

## Constraints

- No new npm dependencies
- No inline styles — Tailwind only
- TypeScript strict — no `any`; `PersonEntry` interface typed explicitly
- Do not use `useEffect` for calculations — derive all results directly from state during render
- Currency always 2 decimal places
- Custom tip clamps 0–100 on blur
- `−` stepper disabled at 1 person (equal mode); remove `✕` disabled at 1 row (per-person mode)
- Mode switch must carry state: equal→per-person pre-fills amounts, per-person→equal sums the total
- Dark mode required on every element
- `aria-pressed` on mode toggle buttons and tip preset buttons
