# Conventions: Snappet

**Last updated**: 2026-03-29

## File & folder structure

```
src/
  apps/             One folder per mini-app (e.g. apps/tip-calculator/)
    tip-calculator/
      index.tsx     App entry component (named export + default export)
      components/   Sub-components used only by this app
  components/       Shared UI components (Button, Input, Card, Layout, etc.)
  hooks/            Shared custom hooks
  utils/            Pure utility functions (no React)
  router/           Route definitions
  styles/           Global CSS, Tailwind config overrides
```

## Naming

- **Files**: kebab-case (`tip-calculator.tsx`, `use-clipboard.ts`)
- **Components**: PascalCase (`TipCalculator`, `ResultCard`)
- **Hooks**: camelCase prefixed with `use` (`useClipboard`, `useLocalStorage`)
- **Utils**: camelCase (`formatCurrency`, `parseJson`)
- **Types/interfaces**: PascalCase, no `I` prefix (`AppMeta`, `ConversionResult`)

## Components

- Functional components only — no class components
- Props interfaces defined inline above the component or in a co-located `types.ts`
- Default exports for page-level components, named exports for shared components
- Each mini-app exports a default component from its `index.tsx`

## Styling

- Tailwind CSS utility classes only — no inline styles, no CSS-in-JS
- Dark mode via Tailwind's `dark:` variant (class strategy, toggled on `<html>`)
- Responsive via Tailwind breakpoints (`sm:`, `md:`, `lg:`) — mobile-first
- No custom CSS unless absolutely unavoidable (e.g. a specific animation); put it in `src/styles/`
- Shared design tokens (colors, spacing) configured in `tailwind.config.ts`

## State management

- `useState` and `useReducer` for local component state
- `useContext` for app-wide state (dark mode toggle, etc.)
- No external state library unless a mini-app genuinely requires it
- Persist user preferences (dark mode) in `localStorage`

## TypeScript

- Strict mode enabled (`"strict": true` in tsconfig)
- No `any` — use `unknown` and narrow, or define proper types
- All function parameters and return types explicitly typed
- Avoid type assertions (`as Foo`) unless dealing with DOM or third-party types

## Routing

- React Router v6 with `BrowserRouter`
- Each mini-app lives at a clean path: `/tip-calculator`, `/json-formatter`, etc.
- Hub/landing page at `/`
- GitHub Pages 404 redirect: copy `index.html` as `404.html` in the build step

## Testing

- Vitest + Testing Library for unit and component tests
- Test files co-located: `tip-calculator.test.tsx` next to `tip-calculator.tsx`
- Test pure utility functions first; component tests for interactive behavior

## Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Branch naming: `feat/tip-calculator`, `fix/dark-mode-flash`
- PRs are small and focused — one mini-app or one fix per PR
- GitHub Actions deploys automatically on merge to `main`
