# Prompt: Age Calculator

**File**: pdd/prompts/features/age-calculator/12-age-calculator.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: GitHub issue #5
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Age Calculator mini-app at `/age-calculator`. Enter a birthdate and instantly see your exact age in years/months/days, days until your next birthday, the day of the week you were born, and your total days lived.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies.

**Conventions**:
- Functional components only
- Tailwind utility classes (`dark:` variants required for every styled element)
- No `any`
- Files in `src/frontend/apps/age-calculator/`
- Default export from `index.tsx`
- Persist birthdate via `useLocalStorage` under `snappet:age-calculator:birthdate`
- Reset button clears state

## Task

Build a single-component mini-app that:

1. **Birthdate input** — native `<input type="date">`, max set to today (no future dates)
2. **Stats grid** showing four metrics, computed live as the date changes:
   - **Exact age**: years, months, days (proper borrow handling — e.g. 30 years, 11 months, 23 days)
   - **Days until next birthday**: integer + the full date of that birthday (e.g. "194 days · Dec 7, 2026"); if today is the birthday, say "Today!"
   - **Day of week born**: full name (Sunday … Saturday)
   - **Total days lived**: integer
3. **Reset button** that clears the saved birthdate and the displayed stats
4. **Empty state** when no date is selected — friendly prompt explaining what the app does

## Date math

```ts
// Exact age — handle borrows so day/month are never negative
function calcAge(birth: Date, now: Date): { years: number; months: number; days: number }

// Days until next birthday — if today, return 0; if already-passed this year, use next year
function daysUntilNextBirthday(birth: Date, now: Date): { days: number; nextDate: Date }

// Day of week — return the full English name from getDay()
function dayOfWeek(d: Date): string

// Total days lived — floor((now - birth) / 86_400_000)
function totalDaysLived(birth: Date, now: Date): number
```

All math runs in local time. Parse the `<input type="date">` value (`YYYY-MM-DD`) by splitting and constructing `new Date(year, month - 1, day)` so the date is interpreted in local time, not UTC.

## Output format

### 1. `src/frontend/apps/age-calculator/index.tsx`

Default-exported `AgeCalculator` component with everything in one file (this is a simple app — splitting would be premature).

Imports only React, the `useLocalStorage` hook from `../../hooks/useLocalStorage`, and (optionally) a `useMemo` for the derived stats.

Layout:
- Header row: title + description on the left, Reset button on the right (matches the pattern used by Tip Calculator / Expense Splitter / Kanban Board)
- Card with the date input and an inline "Selected: <human-readable date>" line
- Stats grid (`grid-cols-1 sm:grid-cols-2`) of four cards:
  1. Age — primary stat (big number for years + secondary text for months + days)
  2. Next birthday — number of days + the date below
  3. Born on — day of week
  4. Total days — big integer with thousands separators (use `toLocaleString()`)

Layout container: `max-w-3xl mx-auto space-y-6`.

Card styling matches the rest of the project: `rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm`.

### 2. `src/frontend/router/routes.tsx` (append)

Append a new entry to the `routes` array:
```ts
{
  path: '/age-calculator',
  label: 'Age Calculator',
  description: 'Calculate your exact age, days until your next birthday, and more.',
  category: 'Calculators',
  icon: '🎂',
  component: lazy(() => import('../apps/age-calculator')),
}
```

## Acceptance criteria (from issue #5)

- [ ] Calculates age correctly including leap years
- [ ] Days until next birthday accurate (handles same-day birthday → "Today!")
- [ ] Day of week calculated correctly
- [ ] Results update instantly on date change
- [ ] Birthdate persisted to localStorage + Reset button
- [ ] Works on mobile (375px)
- [ ] Dark mode support
- [ ] Build passes (`tsc && vite build`)
- [ ] No `any` types

## Constraints

- Future dates: disable via `max={todayIsoString}` on the input AND show an inline error if the persisted value somehow drifts into the future (defensive)
- Year 0 / very old dates: no special handling required — JS `Date` supports years from −271821 to +275760
- All math is local-time. No UTC unless explicitly stated.
- A single `now: Date` is captured per render via `new Date()` — fine for this app; we don't need a ticker to update at midnight
