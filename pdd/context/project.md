# Project: Snappet

**Last updated**: 2026-03-30
**Type**: Frontend / Web app

## What we're building

Snappet is a hub of lightweight single-page web apps — each one focused on doing exactly one thing well. Tools range from practical utilities (bill splitting, QR codes, JSON formatting) to productivity apps (Pomodoro timer, word counter) and developer helpers (regex tester, Base64 encoder). The experience should feel like opening a sharp, focused tool instantly with zero friction.

## Who it's for

Everyday users, students, professionals, and developers who need quick, no-install tools for small everyday problems. Users may arrive via a direct link to a specific mini-app or browse the hub for something useful.

## Stack

- **Language**: TypeScript
- **Framework**: React 18
- **Styling**: Tailwind CSS (dark mode via `dark:` classes, responsive via built-in breakpoints)
- **Routing**: React Router v6 with BrowserRouter + GitHub Pages 404 redirect trick
- **Bundler**: Vite
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions (auto-build and deploy on push to `main`)

## What good output looks like

- Visually appealing and professional — not a developer side project aesthetic
- Dark mode support is required for every mini-app, not optional
- Fully responsive and adaptive: works well on desktop, tablet, iPhone, and Android
- Fast to load and use — no unnecessary steps, modals, or config before a user can interact
- Each mini-app should feel self-contained: someone landing directly on `/tip-calculator` should have everything they need without navigating elsewhere
- Clean, consistent UI language across all mini-apps (shared components, consistent spacing and typography)

## Constraints (what the AI should never do or suggest)

- No backend, no server — everything runs client-side only
- No user accounts, login flows, or data persistence beyond localStorage if needed
- No heavy dependencies that bloat bundle size (avoid full UI libraries like MUI or Ant Design)
- No feature creep within a mini-app — each app does one thing, not three
- Do not suggest class components or non-TypeScript code
- Do not add analytics, tracking, or third-party scripts unless explicitly asked

## Current state

**Live at**: https://harshal2802.github.io/Snappet/

### Built and deployed

| App | Route | Category | Notes |
|---|---|---|---|
| Hub / Landing Page | `/` | — | Search + category chip filter, responsive 4-col grid |
| Tip Calculator | `/tip-calculator` | Calculators | Equal split + per-person mode, preset/custom tip %, localStorage persisted |
| Expense Splitter | `/expense-splitter` | Calculators | Multi-expense, equal/custom split per expense, localStorage persisted |

### Shared infrastructure built

- `src/frontend/hooks/useDarkMode.ts` — dark mode toggle, persisted to localStorage, FOUC-free
- `src/frontend/hooks/useLocalStorage.ts` — generic drop-in for `useState` that persists to localStorage; all mini-apps should use this for user-facing state
- `src/frontend/router/routes.tsx` — centralized route registry with `AppRoute` type (`path`, `label`, `description`, `category`, `icon`, `component`)
- `src/frontend/apps/hub/AppCard.tsx` — shared app card component used by the hub
- GitHub Actions deploy workflow — auto-deploys on push to `main`
- Reset button pattern — every mini-app has an `↺ Reset` button (top-right, muted style) that restores defaults with fresh IDs

### Patterns established (follow these in all future mini-apps)

1. **State persistence**: use `useLocalStorage('snappet:<app-slug>:<field>', default)` for all user-facing state
2. **Reset**: define `DEFAULTS` or `makeDefaultState()` at module level; `handleReset` sets all values back and generates fresh IDs
3. **Reset button**: top-right of page header, `↺ Reset` label, muted style with red hover
4. **Route registration**: add entry to `src/frontend/router/routes.tsx` with all 5 fields (`path`, `label`, `description`, `category`, `icon`)
5. **Folder**: one folder per app under `src/frontend/apps/<app-slug>/`, default export from `index.tsx`
6. **Branch + PR**: every new app or feature gets its own branch (`feat/<name>`) and PR before merging to `main`

## Backlog (GitHub issues)

| Issue | App | Category |
|---|---|---|
| harshal2802/Snappet#5 | Color Picker & Converter | Developer Tools |
| harshal2802/Snappet#6 | Pomodoro Timer | Productivity |
| harshal2802/Snappet#7 | Password Generator | Utilities |
| harshal2802/Snappet#8 | JSON Formatter | Developer Tools |
| harshal2802/Snappet#9 | Age Calculator | Calculators |

## Planned mini-apps (full list)

**Utilities**: Base64 Encoder/Decoder, Regex Tester, URL Encoder/Decoder, UUID Generator, Password Generator (#7)
**Calculators**: BMI Calculator, Age Calculator (#9), Percentage Calculator, Unit Converter
**Productivity**: Pomodoro Timer (#6), Countdown Timer, Word Counter, Markdown Previewer
**Developer Tools**: Color Picker & Converter (#5), CSS Gradient Generator, Aspect Ratio Calculator, JSON Formatter (#8)
**Creative**: Random Name Picker, Lorem Ipsum Generator, QR Code Generator
