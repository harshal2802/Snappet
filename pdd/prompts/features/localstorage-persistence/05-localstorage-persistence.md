# Prompt: localStorage Persistence + Reset Button

**File**: pdd/prompts/features/localstorage-persistence/05-localstorage-persistence.md
**Created**: 2026-03-30
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet mini-apps should persist their state across page refreshes using localStorage. Users should not lose their work when they refresh. Each app also needs a reset button to restore defaults.

This feature introduces a shared `useLocalStorage` hook that any mini-app can use.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, Vite. No new dependencies.

**Conventions**:
- `useLocalStorage` lives in `src/frontend/hooks/useLocalStorage.ts`
- localStorage keys follow the pattern `snappet:<app-slug>:<field>`
- Reset generates fresh IDs — never reuses stale ones
- The hook must be safe for private browsing (catch localStorage errors)

## Task

Add a shared `useLocalStorage` hook and apply it to the Tip Calculator and Expense Splitter mini-apps so their state survives page refresh. Add an `↺ Reset` button to each app that restores all state to defaults.

## Input

Existing files:
- `src/frontend/hooks/` — add `useLocalStorage.ts` here
- `src/frontend/apps/tip-calculator/index.tsx` — replace `useState` with `useLocalStorage` for persistent state
- `src/frontend/apps/expense-splitter/index.tsx` — same

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/hooks/useLocalStorage.ts`

Generic hook — drop-in replacement for `useState`:

```ts
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>]
```

Behavior:
- Reads from `localStorage` on first render (via `useState` lazy initializer)
- Writes to `localStorage` via `useEffect` on every value change
- Falls back to `initialValue` if key is missing or `JSON.parse` throws
- Silently catches `localStorage.setItem` errors (private browsing, quota exceeded)

### 2. `src/frontend/apps/tip-calculator/index.tsx` (updated)

Replace all `useState` calls for persistent state with `useLocalStorage`. Keys:
- `snappet:tip:tipOption`
- `snappet:tip:customTipInput`
- `snappet:tip:splitMode`
- `snappet:tip:billInput`
- `snappet:tip:people`
- `snappet:tip:personEntries`

Define a `DEFAULTS` constant at module level with all default values.

Add a `handleReset` function that sets every value back to its default. For `personEntries`, generate fresh IDs on reset (call `generateId()` — do not reuse stored IDs).

Add an `↺ Reset` button:
- Position: top-right of the page header, next to the title
- Style: small, unobtrusive — muted text color, border, turns red on hover
- `focus-visible:ring-2 focus-visible:ring-red-500` for keyboard accessibility

### 3. `src/frontend/apps/expense-splitter/index.tsx` (updated)

Replace `useState` for `people` and `expenses` with `useLocalStorage`. Keys:
- `snappet:expense:people`
- `snappet:expense:expenses`

Add a `makeDefaultState()` helper that creates 2 fresh people + 1 blank expense (with new IDs). Use it for both the initial `useLocalStorage` value and for `handleReset`.

Add `handleReset`:
- Calls `makeDefaultState()` for fresh IDs
- Resets `people`, `expenses`, `nameInput`, `removeError`

Add the same `↺ Reset` button pattern as the Tip Calculator.

## Constraints

- No new npm dependencies
- `useLocalStorage` initializer must use `useState` lazy init (function form) — not `useEffect` — so the value is available on first render without flicker
- `JSON.parse` and `localStorage.setItem` must both be wrapped in try/catch
- Reset must call `generateId()` for new IDs — never reuse IDs from localStorage
- `↺ Reset` button must not be a primary action — keep it visually secondary (muted, small)
- Dark mode required on the reset button
- Do not persist ephemeral UI state: `nameInput`, `removeError`, `customTipInput` display value — only persist data the user would consider "their work"

## When applying to a new mini-app

To add persistence to any future mini-app:
1. Import `useLocalStorage` from `../../hooks/useLocalStorage`
2. Replace `useState` with `useLocalStorage('<key>', defaultValue)` for each state value to persist
3. Define a `DEFAULTS` constant or `makeDefaultState()` function at module level
4. Add a `handleReset` function that resets all values to defaults (generate fresh IDs if needed)
5. Add the `↺ Reset` button to the app header
6. Key naming: `snappet:<app-slug>:<field>`
