# Prompt: Code Snapshot Generator

**File**: pdd/prompts/features/code-snapshot/09-code-snapshot.md
**Created**: 2026-05-26
**Updated**: 2026-05-26
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. Each mini-app lives at its own route and does one thing well. This is the Code Snapshot Generator mini-app at `/code-snapshot`.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy, mobile-first), React Router v6, Vite. Dependencies: `html-to-image`, `prism-react-renderer`.

**Conventions**:
- Functional components, no class components
- Tailwind utility classes only — no inline styles, no CSS-in-JS
- No `any` — all types explicit
- Files go in `src/frontend/apps/code-snapshot/`
- Default export from `index.tsx`
- State persistence via `useLocalStorage` hook with keys prefixed `snappet:code-snapshot:`
- Every app must include a `Reset` button

## Task

Build a Code Snapshot Generator — a tool that creates beautiful, shareable code images similar to ray.so or carbon.now.sh. Users paste code, customize the appearance (theme, background gradient, padding, border radius, font size, window chrome, line numbers), and export the result as a PNG download or clipboard copy.

## Input

Fresh folder `src/frontend/apps/code-snapshot/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/apps/code-snapshot/types.ts`

Type definitions for:
- `SupportedLanguage` — union of supported language identifiers
- `LanguageOption` — `{ value, label }` pair
- `ThemeId` — union of theme identifiers (dracula, oneDark, githubDark, githubLight, monokai, nord, solarizedDark)
- `ThemeDefinition` — `{ id, label, prismTheme, bgColor, isLight }`
- `BackgroundId` — union of background gradient identifiers
- `BackgroundOption` — `{ id, label, gradient }`
- Preset value types for padding, border radius, font size
- `SnapshotSettings` — full settings shape

### 2. `src/frontend/apps/code-snapshot/themes.ts`

Theme and background definitions:
- 7 syntax themes with PrismTheme objects (Dracula, One Dark, GitHub Dark, GitHub Light, Monokai, Nord, Solarized Dark)
- 8 background gradients (Sunset, Ocean, Forest, Midnight, Peach, Arctic, Candy, None)
- Language list with labels
- Helper functions: `getTheme()`, `getBackground()`, `getLanguageLabel()`

### 3. `src/frontend/apps/code-snapshot/index.tsx`

Main component with:

**Layout** (`max-w-6xl mx-auto`):
- Desktop: Code input + Preview (left, ~65%) | Controls sidebar (right, ~35%)
- Mobile: Code input, then Preview, then Controls stacked vertically

**Code Input**:
- Textarea with monospace font, placeholder example code snippet
- Line count indicator

**Live Preview** (the exported output — WYSIWYG):
- Outer container with selected gradient background and configurable padding
- Inner code window with theme background color, configurable border radius, shadow
- Optional macOS traffic light window controls (red/yellow/green dots)
- Syntax-highlighted code via `prism-react-renderer` `<Highlight>` component
- Optional line numbers (dimmed, non-selectable)
- Configurable font size

**Controls Sidebar**:
- Language selector (dropdown)
- Theme selector (color swatches grid, click to select)
- Background selector (gradient swatches grid, click to select)
- Padding presets (16/32/48/64 px, button group)
- Border radius presets (0/8/16/24 px, button group)
- Font size presets (14/16/18/20 px, button group)
- Toggle: Show window controls
- Toggle: Show line numbers

**Export Buttons**:
- "Copy Image" — uses `toBlob()` + `ClipboardItem` API
- "Download PNG" — uses `toPng()` with `pixelRatio: 2`
- Shown in preview header on desktop, duplicated below controls on mobile

**State Persistence**:
- All settings persisted via `useLocalStorage` with `snappet:code-snapshot:` prefix
- Reset button restores all defaults

### 4. `src/frontend/router/routes.tsx` (update only)

Add route entry:
```typescript
{
  path: '/code-snapshot',
  label: 'Code Snapshot',
  description: 'Generate beautiful code screenshots with customizable themes.',
  category: 'Developer Tools',
  icon: '📸',
  component: lazy(() => import('../apps/code-snapshot')),
}
```

## Quality bar

- Build must pass: `tsc && vite build`
- All UI elements must have dark mode variants
- Mobile responsive: stacked layout on small screens
- Preview must look visually stunning — polished window chrome, beautiful gradients
- No TypeScript `any` types
- Accessible: proper labels, focus-visible rings, aria attributes on toggles
