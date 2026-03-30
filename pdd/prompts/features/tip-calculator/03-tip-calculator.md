# Prompt: Tip Calculator

**File**: pdd/prompts/features/tip-calculator/03-tip-calculator.md
**Created**: 2026-03-30
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

Build a Tip Calculator mini-app that takes a bill amount, tip percentage, and number of people, then shows a clear breakdown of tip and total per person.

## Input

Fresh folder `src/frontend/apps/tip-calculator/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/apps/tip-calculator/index.tsx`

The complete tip calculator component. Layout and behavior:

**Inputs section**:
- **Bill amount** — numeric input, currency formatted, placeholder `"0.00"`, min 0
- **Tip percentage** — preset pill buttons: `10%` `15%` `18%` `20%` `25%` + a custom input field that activates when "Custom" pill is selected. Only one tip option active at a time.
- **Number of people** — stepper (− / + buttons) with a numeric input in the middle, min 1, max 50

**Results section** (updates live as inputs change, no submit button):
- **Tip per person** — prominent, large display
- **Total per person** — most prominent, largest display
- **Subtotals row** — tip amount (total) + grand total (total), smaller muted text

**Behavior**:
- All results derived inline from state — no `useEffect` for calculations
- If bill is 0 or empty, results show `$0.00`
- Tip % custom input: show a text field inline when "Custom" is selected; validate 0–100
- Currency formatting: always 2 decimal places, `$` prefix
- Number of people stepper: `-` button disabled when people = 1

**Layout**:
- Single column, card-based layout — inputs card on top, results card below
- Results card has a subtle colored background to distinguish it visually
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
- TypeScript strict — no `any`
- Do not use `useEffect` for calculations — derive results directly from state during render
- Currency values must always display with exactly 2 decimal places
- The "Custom" tip input must clamp between 0 and 100 on blur
- Stepper `−` button must be visually disabled (`opacity-50 cursor-not-allowed`) when people = 1
- Results must update instantly as any input changes — no submit/calculate button
- Dark mode required on all elements
