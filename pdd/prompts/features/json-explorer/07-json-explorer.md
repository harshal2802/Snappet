# Prompt: JSON Explorer & Diff

**File**: pdd/prompts/features/json-explorer/07-json-explorer.md
**Created**: 2026-05-26
**Updated**: 2026-05-26
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. Each mini-app lives at its own route and does one thing well. This is the JSON Explorer & Diff mini-app at `/json-explorer`.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy, mobile-first), React Router v6, Vite. No new dependencies.

**Conventions**:
- Functional components, no class components
- Tailwind utility classes only — no inline styles
- No `any` — all types explicit
- Files go in `src/frontend/apps/json-explorer/`
- Default export from `index.tsx`
- State persistence via `useLocalStorage` hook with `snappet:json-explorer:` key prefix
- Every app must have a `↺ Reset` button

## Task

Build a JSON Explorer & Diff mini-app with two modes:

1. **Explorer Mode** — Paste JSON, format/minify, view as collapsible tree with color-coded values, search/filter, and click-to-copy JSON paths.
2. **Diff Mode** — Side-by-side JSON inputs with structural diff showing additions (green), removals (red), and changes (yellow) with a summary count.

## Input

Fresh folder `src/frontend/apps/json-explorer/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/apps/json-explorer/types.ts`

Shared type definitions for JSON value types, tree node representation, and diff result types.

### 2. `src/frontend/apps/json-explorer/JsonTree.tsx`

Recursive tree view component:
- Objects show `{...}` with key count, arrays show `[...]` with item count
- Click to expand/collapse nodes
- Color-coded values: strings (green), numbers (blue), booleans (purple), null (gray)
- Click any node path to copy JSON path to clipboard with "Copied!" toast
- Expand All / Collapse All buttons
- Search/filter highlighting matching keys or values

### 3. `src/frontend/apps/json-explorer/JsonDiff.tsx`

Structural diff view component:
- Added keys/values highlighted in green
- Removed keys/values highlighted in red
- Changed values highlighted in yellow showing old → new
- Unchanged fields shown normally (collapsible)
- Summary: "X additions, Y removals, Z changes"

### 4. `src/frontend/apps/json-explorer/index.tsx`

Main component with mode toggle (Explorer | Diff), text areas, format/minify buttons, error display, and the tree/diff views.

### 5. `src/frontend/router/routes.tsx` (updated)

Add the JSON Explorer route:
```ts
{
  path: '/json-explorer',
  label: 'JSON Explorer',
  description: 'Format, explore, and diff JSON data with a collapsible tree view.',
  category: 'Developer Tools',
  icon: '🔍',
  component: lazy(() => import('../apps/json-explorer')),
}
```

## Constraints

- No new npm dependencies
- No inline styles — Tailwind only
- TypeScript strict — no `any`
- Dark mode required on every element
- Mobile-first responsive design
- `max-w-4xl mx-auto` for wider layout
- Cards with `rounded-2xl border bg-white dark:bg-gray-800 p-6 shadow-sm`
- Tree nodes use `font-mono` with `pl-4` indent per level
- Use `navigator.clipboard.writeText()` for copy
- Parse JSON with `JSON.parse` in try/catch with error position
- Build tree recursively — no external tree library
- For diff, recursively compare two parsed JSON objects
- State persists via `useLocalStorage` hook
