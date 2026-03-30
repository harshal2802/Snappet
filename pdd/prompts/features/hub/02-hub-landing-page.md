# Prompt: Hub / Landing Page

**File**: pdd/prompts/features/hub/02-hub-landing-page.md
**Created**: 2026-03-29
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. The landing page at `/` is the discovery surface — users browse, search, and jump into mini-apps from here. Users may also land directly on a mini-app URL, so the hub is optional navigation, not required.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy), React Router v6, Vite.

**Existing files to modify**:
- `src/frontend/router/routes.tsx` — currently has `AppRoute { path, label, component }`. Needs extending with metadata.
- `src/frontend/App.tsx` — has an inline `Home` placeholder component. Replace it with an import.

**New files to create**:
- `src/frontend/apps/hub/index.tsx` — the hub landing page
- `src/frontend/apps/hub/AppCard.tsx` — individual app card component

**Current `AppRoute` interface** (in `src/frontend/router/routes.tsx`):
```ts
export interface AppRoute {
  path: string
  label: string
  component: ComponentType
}
```

## Task

Build the hub landing page for Snappet: extend the route metadata with description, category, and icon; build a responsive app grid with live search and category chip filtering; and wire it into the existing router shell.

## Input

The existing scaffold at `src/frontend/`. No new dependencies — use only what is already installed (React, React Router, Tailwind CSS).

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/router/routes.tsx` (updated)

Extend `AppRoute` with:
- `description: string` — one-line description shown on the card
- `category: AppCategory` — one of the five categories
- `icon: string` — a single relevant emoji representing the app

Add a union type:
```ts
export type AppCategory = 'Utilities' | 'Calculators' | 'Productivity' | 'Developer Tools' | 'Creative'
```

Update the existing example route entry with appropriate values. Keep lazy loading.

### 2. `src/frontend/apps/hub/AppCard.tsx`

Props: `route: AppRoute`

Card layout (clickable, navigates to `route.path` via React Router `<Link>`):
- Large emoji icon centered at top
- App name (`route.label`) in bold
- Short description (`route.description`) in muted text
- Category badge (small pill/chip, color-coded per category)

Styling requirements:
- Rounded card with subtle border and shadow
- Hover: slight lift effect (`hover:-translate-y-1 transition-transform`) + stronger border/shadow
- Dark mode variants for all colors
- Fully keyboard accessible (the `<Link>` wraps the card)

### 3. `src/frontend/apps/hub/index.tsx`

The hub page component. Structure:

**Hero section**:
- Snappet wordmark/title (large, bold)
- One-line tagline: *"Fast, focused tools for everyday tasks"*

**Controls row** (below hero):
- Search bar: text input, filters by `label` and `description` (case-insensitive), debounced 150ms
- Category chips: `All` + one chip per `AppCategory` — `All` selected by default, single-select
- Show result count: *"Showing X of Y tools"*

**App grid**:
- Responsive: 1 column on mobile, 2 on `sm`, 3 on `md`, 4 on `lg`
- Renders filtered `routes` array from `src/frontend/router/routes.tsx` as `<AppCard>` components
- Empty state: friendly message + emoji when no results match (*"No tools found. Try a different search."*)

**State**:
- `searchQuery: string` (controlled input)
- `activeCategory: AppCategory | 'All'`
- Filtered list derived from both (no extra state)

### 4. `src/frontend/App.tsx` (updated)

Replace the inline `Home` component with:
```ts
import HubPage from './apps/hub'
// ...
<Route path="/" element={<HubPage />} />
```

Remove the old inline `Home` function entirely.

## Constraints

- No new npm dependencies — emoji icons only, no icon library
- No inline styles — Tailwind utility classes only
- TypeScript strict — no `any`, all props typed
- The search filter must be case-insensitive and match against both `label` and `description`
- Category chips must be keyboard accessible (focusable, activatable with Enter/Space)
- The `Example` app in `routes.tsx` should use category `'Utilities'`, icon `'🔧'`, and a placeholder description
- Do not use `useEffect` for the filtered list — derive it inline from state during render
- The hub must look polished on mobile (375px) and desktop (1440px) — test both mentally before writing
- Category chip colors: Utilities=blue, Calculators=green, Productivity=purple, Developer Tools=orange, Creative=pink — provide dark mode variants
