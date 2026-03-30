# Prompt: Project Scaffold

**File**: pdd/prompts/features/scaffold/01-project-setup.md
**Created**: 2026-03-29
**Updated**: 2026-03-29
**Project type**: Frontend / Web app

## Context

Snappet is a hub of lightweight single-page web apps. Each mini-app lives at its own route (e.g. `/tip-calculator`) and does one thing well. The hub itself lives at `/`.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite, deployed to GitHub Pages via GitHub Actions.

**Key requirements**:
- Dark mode support via Tailwind `dark:` class strategy (toggled on `<html>`, persisted in `localStorage`)
- Fully responsive (mobile-first, Tailwind breakpoints)
- BrowserRouter with GitHub Pages 404 redirect (spa-github-pages technique)
- One folder per mini-app directly under `src/frontend/apps/`
- All frontend source and tooling lives self-contained under `src/frontend/`
- A `Makefile` at the repo root proxies all commands into `src/frontend/`

## Task

Scaffold the complete Snappet project from scratch: initialize a Vite + React + TypeScript app under `src/frontend/`, configure Tailwind CSS with dark mode, set up React Router v6, establish the folder structure, create a root-level Makefile, and create the GitHub Actions workflow that builds and deploys to GitHub Pages.

## Input

A fresh, empty directory. No existing source code.

## Output format

Provide the following — in order:

1. **Shell commands** to initialize the project

2. **File tree** showing the complete folder structure:

   ```
   <project-root>/
   ├── .github/workflows/deploy.yml
   ├── .gitignore
   ├── Makefile
   ├── pdd/
   └── src/
       └── frontend/
           ├── apps/example/index.tsx
           ├── components/Layout.tsx
           ├── hooks/useDarkMode.ts
           ├── router/routes.tsx
           ├── public/404.html
           ├── App.tsx
           ├── index.css
           ├── index.html
           ├── main.tsx
           ├── vite-env.d.ts
           ├── package.json
           ├── postcss.config.js
           ├── tailwind.config.ts
           ├── tsconfig.json
           ├── tsconfig.node.json
           └── vite.config.ts
   ```

3. **Full file contents** for each of these files:
   - `src/frontend/vite.config.ts` — with `base` driven by `VITE_BASE_PATH` env variable (default `/Snappet/`)
   - `src/frontend/tailwind.config.ts` — `darkMode: 'class'`, content paths scoped to explicit subdirectories (no broad globs that match `node_modules`)
   - `src/frontend/postcss.config.js` — tailwindcss + autoprefixer
   - `src/frontend/tsconfig.json` — strict mode, excludes `vite.config.ts` and `tailwind.config.ts`
   - `src/frontend/tsconfig.node.json` — for Vite config compilation
   - `src/frontend/index.html` — includes the spa-github-pages redirect handler script; script src points to `/main.tsx`
   - `src/frontend/main.tsx` — React root with `BrowserRouter`, basename from `import.meta.env.BASE_URL` (trailing slash stripped)
   - `src/frontend/App.tsx` — router shell with routes from `router/routes.tsx`, `Suspense` wrapper, home and 404 fallback
   - `src/frontend/components/Layout.tsx` — top nav (logo + route links + dark mode toggle), `<main>`, footer
   - `src/frontend/hooks/useDarkMode.ts` — reads/writes `localStorage`, respects `prefers-color-scheme`, toggles `dark` class on `<html>`
   - `src/frontend/router/routes.tsx` — centralized route config (`AppRoute[]`), lazy-loaded components
   - `src/frontend/apps/example/index.tsx` — minimal placeholder component
   - `src/frontend/public/404.html` — spa-github-pages redirect script (`pathSegmentsToKeep = 1`)
   - `.github/workflows/deploy.yml` — install → build → deploy; all npm steps use `working-directory: src/frontend`; `publish_dir: ./src/frontend/dist`; `cache-dependency-path: src/frontend/package-lock.json`
   - `Makefile` — root-level, delegates `install / dev / build / preview / clean` into `src/frontend/` via a `FRONTEND` variable
   - `.gitignore` — ignores `node_modules/` and `dist/`

4. **Post-setup checklist** — steps the developer must do manually after running the commands

## Constraints

- No CSS-in-JS, no inline styles — Tailwind utility classes only
- No UI component libraries (no MUI, Chakra, Radix, etc.)
- TypeScript strict mode — no `any`, all types explicit
- `VITE_BASE_PATH` env variable controls the Vite `base`; default to `/Snappet/` with a comment showing where to change it
- The 404 redirect must preserve the path so React Router can pick it up on load
- Keep `App.tsx` and `Layout.tsx` minimal — just the shell, no real content
- GitHub Actions workflow triggers only on push to `main`
- All npm commands (install, build, dev, preview) must be run from `src/frontend/` — never from the repo root
- Tailwind content globs must not match `node_modules` — use explicit subdirectory paths
- `tsconfig.json` must exclude `vite.config.ts` and `tailwind.config.ts` to avoid compiler conflicts
