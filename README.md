# Snappet

> **A hub of 20+ lightweight, single-purpose browser tools — fast, private, and free.**
> No sign-up, no install, no backend. Everything runs client-side and works offline.

**Live:** https://harshal2802.github.io/Snappet/
&nbsp;·&nbsp; **Knowledge graph:** https://harshal2802.github.io/Snappet/knowledge-graph/

Snappet is a collection of sharp, focused mini-apps — calculators, developer utilities,
productivity tools, a workout library, and a fully client-side video editor — that each do
exactly one thing well. Land directly on `/tip-calculator` or browse the hub; either way you
get a polished tool instantly, with dark mode and a mobile-first responsive layout everywhere.

---

## Table of contents

- [Highlights](#highlights)
- [The tools](#the-tools)
- [Knowledge graph](#knowledge-graph)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Build & deploy](#build--deploy)
- [Prompt-Driven Development (the product brain)](#prompt-driven-development-the-product-brain)
- [Conventions](#conventions)
- [Native initiative](#native-initiative)
- [Documentation](#documentation)

---

## Highlights

- **20+ tools, one hub** — searchable, category-filtered, sorted by your own usage.
- **100% client-side** — no server, no accounts, no tracking. Your data never leaves your device (localStorage only).
- **Installable PWA** — works offline; precaches the app shell and prompts you when an update ships.
- **Dark mode everywhere** — FOUC-free, persisted, on every screen.
- **Mobile-first** — built and tuned for phones as much as desktops.
- **SEO + AEO ready** — every route is prerendered to static HTML with unique metadata, JSON-LD, `sitemap.xml`, `robots.txt`, and `llms.txt` so it's visible to search engines *and* AI crawlers.
- **Guided tours** — every tool has a built-in walkthrough that auto-runs once on first visit, with a `? Tour` button to replay it anytime (see below).
- **Interactive knowledge graph** — a hostable, dependency-free visualization of the whole codebase (see below).

## The tools

| Tool | Route | Category | What it does |
|---|---|---|---|
| Tip Calculator | `/tip-calculator` | Calculators | Tip + split a bill across any group size |
| Expense Splitter | `/expense-splitter` | Calculators | Share group expenses with custom splits and settle-up |
| Age Calculator | `/age-calculator` | Calculators | Exact age + countdown to your next birthday |
| Unit Converter | `/unit-converter` | Calculators | Length, weight, temperature, volume, speed, time, data |
| Kanban Board | `/kanban-board` | Productivity | Drag-and-drop task board |
| Markdown Editor | `/markdown-editor` | Productivity | Live side-by-side Markdown preview + export |
| Pomodoro Timer | `/pomodoro-timer` | Productivity | 25/5 focus timer with long breaks |
| Stopwatch | `/stopwatch` | Productivity | Accurate stopwatch with lap splits |
| JSON Explorer | `/json-explorer` | Developer Tools | Format, minify, validate, tree-explore, and diff JSON |
| Regex Playground | `/regex-playground` | Developer Tools | Live regex tester with highlighting, groups, flags |
| Code Snapshot | `/code-snapshot` | Developer Tools | Beautiful, shareable code-to-image PNGs |
| Color Picker | `/color-picker` | Developer Tools | HEX ⇄ RGB ⇄ HSL + WCAG contrast checker |
| Password Generator | `/password-generator` | Utilities | Cryptographically-random passwords + strength meter |
| QR Code Generator | `/qr-code` | Utilities | QR codes for text, URLs, WiFi, contacts |
| Tally Counter | `/tally-counter` | Utilities | Giant tap-anywhere counter |
| Random Picker | `/random-picker` | Utilities | Coin flip, dice, list pick, random number |
| Document Viewer | `/doc-viewer` | Utilities | View PDFs/images with in-browser OCR |
| Workout | `/workout` | Health | 800+ exercise library, routines, player, progress dashboard |
| Video Editor | `/video-editor` | Creative | Trim/split/sequence + export MP4, all via WebCodecs |
| Board Explorer | `/board-explorer` | Utilities | Filter Aurora climbing-board (Kilter/Tension) catalogues by size/angle/grade, view climbs on the board + export CSV/JSON/SQLite |

## Guided tours

Every mini-app ships a **guided walkthrough** — a short, spotlighted tour of its key controls.
It **auto-runs once** on a user's first visit (remembered per-device in `localStorage`), and a
**`? Tour`** button in each app's header replays it anytime.

The engine is a small, dependency-free shared component at
[`src/frontend/components/GuidedTour/`](src/frontend/components/GuidedTour/): a spotlight overlay +
tooltip with `Back / Next / Skip`, progress dots, keyboard control (`→`/`←`/`Esc`), focus handling,
`prefers-reduced-motion` support, and a mobile layout that docks the tooltip to the bottom.

**Adding a tour to a new app** is two small steps:

1. Tag the elements you want to highlight with a `data-tour` attribute:
   ```tsx
   <div data-tour="bill">…</div>
   ```
2. Author the steps in `apps/<app>/tour.ts` and drop `<GuidedTour>` in the header:
   ```tsx
   // apps/<app>/tour.ts
   import type { TourStep } from '../../components/GuidedTour'
   export const tourSteps: TourStep[] = [
     { title: 'Welcome', body: 'A quick tour — skip anytime.' }, // no target → centered card
     { target: 'bill', title: 'Enter the bill', body: 'Type the total; results update live.' },
   ]
   ```
   ```tsx
   // apps/<app>/index.tsx (in the header, next to ↺ Reset)
   import GuidedTour from '../../components/GuidedTour'
   import { tourSteps } from './tour'
   <GuidedTour appId="<app-slug>" steps={tourSteps} />
   ```

`appId` must match the route slug; completion is keyed to `snappet:tour:<appId>:v<version>` — bump the
`version` prop after editing steps to re-show the tour to returning users.

## Knowledge graph

Snappet ships an **interactive, hostable knowledge graph** — a single static page that maps the
entire codebase: every mini-app, shared hook, build step, third-party dependency, and
product-brain doc, wired by the relationships (containment, routing, runtime use, localStorage
writes, deploy hops, documentation) that connect them.

![Snappet knowledge graph](docs/screenshots/knowledge-graph.png)

- **Hosted at** https://harshal2802.github.io/Snappet/knowledge-graph/
- **Three layouts** — Force / Hierarchy / Clusters
- **Fuzzy search**, **click-to-focus** with a neighbor detail panel, and **shortest-path tracing** between any two nodes
- **Filters** by type, category, and layer; **zoom / pan / drag**; **deep-links** (`?node=<id>`); **PNG export**; light/dark theme
- **Zero dependencies, zero build step** — plain HTML/CSS/JS in [`src/frontend/public/knowledge-graph/`](src/frontend/public/knowledge-graph/), copied verbatim into the deploy by Vite

To update it, edit only [`data.js`](src/frontend/public/knowledge-graph/data.js); the legend,
filters, layouts, and search adapt automatically. The screenshots above are rendered from that
same `data.js` by [`scripts/render-knowledge-graph.mjs`](scripts/render-knowledge-graph.mjs), so
they never drift from the real model. Full docs:
[`src/frontend/public/knowledge-graph/README.md`](src/frontend/public/knowledge-graph/README.md).

## Architecture

```
                       ┌──────────────────────────────────────────┐
   GitHub Actions ───▶ │  Vite build  (tsc + bundle + prerender)   │ ───▶ gh-pages ─▶ GitHub Pages
   (push to main)      │   • SEO prerender plugin (per-route HTML)  │
                       │   • vite-plugin-pwa (offline service worker)│
                       │   • copies public/ (incl. knowledge-graph) │
                       └──────────────────────────────────────────┘

   Runtime (in the browser):

     main.tsx → <App> ─┬─ Layout (header, dark-mode toggle, footer)
                       ├─ useSeoHead   ← seo/meta ← seo/catalog  (single source of truth)
                       ├─ lib/usage    → localStorage (per-device open counts)
                       └─ Routes ──────┬─ Hub (search · filter · sort · usage dashboard)
                                       └─ 21 lazily-loaded mini-apps
                                            └─ useLocalStorage (snappet:<app>:<field>)
```

Key design rules (the *why* lives in [`pdd/context/decisions.md`](pdd/context/decisions.md)):

- **No backend, fully client-side.** Zero hosting cost, no auth surface, instant load.
- **One source of truth for metadata** — [`seo/catalog.ts`](src/frontend/seo/catalog.ts) feeds the routes table, runtime SEO, and the build-time prerenderer, so they can never drift.
- **Shared persistence** — every tool uses `useLocalStorage('snappet:<app>:<field>', default)`; each has a `↺ Reset`.
- **One folder per app** under `src/frontend/apps/<slug>/` with a default export from `index.tsx`.

## Project structure

```
.
├─ README.md                     ← you are here
├─ docs/                         ← documentation + screenshots
│  ├─ README.md                  ← architecture & docs index
│  └─ screenshots/               ← knowledge-graph PNGs (light + dark)
├─ scripts/
│  └─ render-knowledge-graph.mjs ← renders the screenshots from data.js
├─ pdd/                          ← Prompt-Driven Development assets (the product brain)
│  ├─ context/                   ← project brief, conventions, decisions, schema, research
│  └─ prompts/                   ← per-feature prompt chains (how each app was built)
├─ .github/workflows/deploy.yml  ← build + deploy to GitHub Pages
└─ src/frontend/                 ← the app (Vite + React 18 + TS + Tailwind)
   ├─ apps/                      ← one folder per mini-app (+ hub/)
   ├─ components/                ← shared UI (Layout, UpdatePrompt)
   ├─ hooks/                     ← useDarkMode, useLocalStorage
   ├─ lib/                       ← usage.ts (on-device usage tracking)
   ├─ router/routes.tsx          ← path → lazy component registry
   ├─ seo/                       ← catalog (source of truth) + meta/render/useSeoHead
   ├─ public/knowledge-graph/    ← the interactive knowledge graph (static)
   └─ vite.config.ts             ← build + SEO prerender + PWA
```

## Getting started

Prerequisites: **Node 20+**.

```bash
cd src/frontend
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + bundle + prerender + PWA → dist/
npm run preview    # serve the production build locally
```

A `Makefile` at the repo root wraps the common tasks.

## Build & deploy

- **CI/CD:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main`: `npm ci` → `npm run build` → publish `src/frontend/dist` to the `gh-pages` branch.
- **Base path:** the build sets `VITE_BASE_PATH=/Snappet/` so assets and the PWA scope match the GitHub Pages project URL.
- **Routing:** React Router `BrowserRouter` with the GitHub Pages 404-redirect trick (`index.html` is copied as `404.html`) so deep links and refreshes work.
- **SEO/AEO:** the prerender plugin writes one static HTML file per route plus `sitemap.xml`, `robots.txt`, and `llms.txt`.
- **The knowledge graph** lives under `public/`, so it deploys automatically at `/Snappet/knowledge-graph/` — no extra Pages configuration.

## Prompt-Driven Development (the product brain)

Snappet is built with **Prompt-Driven Development**: the thinking lives in the repo next to the code.

- [`pdd/context/project.md`](pdd/context/project.md) — what we're building, who it's for, the stack, and current state
- [`pdd/context/conventions.md`](pdd/context/conventions.md) — coding conventions
- [`pdd/context/decisions.md`](pdd/context/decisions.md) — a dated log of significant technical decisions and their reasoning
- [`pdd/context/research/`](pdd/context/research/) — deep dives backing major features
- [`pdd/prompts/features/`](pdd/prompts/features/) — the prompt chain that produced each feature, numbered in build order

This is also the **product brain** for the native app — see below.

## Conventions

- **TypeScript** strict mode, no `any`; functional components only.
- **Tailwind CSS** only (dark mode via `dark:`, responsive via breakpoints) — no CSS-in-JS, no component libraries.
- **State:** `useState`/`useReducer` locally, `useLocalStorage` for anything user-facing.
- **Git:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`); one focused PR per app/fix; `main` is always deployable.

Full details in [`pdd/context/conventions.md`](pdd/context/conventions.md).

## Native initiative

A native iOS + Android app — flagship: **workout tracking + HR-driven auto-highlight reels** —
lives in a **separate repo**, [`harshal2802/snappet-mobile`](https://github.com/harshal2802/snappet-mobile).
This repo stays the **product brain**: the deep research, the initiative plan
([`pdd/prompts/features/native-mobile/PLAN-snappet-mobile.md`](pdd/prompts/features/native-mobile/PLAN-snappet-mobile.md)),
and the shared **Snappet Core** data-schema spec
([`pdd/context/snappet-core-schema.md`](pdd/context/snappet-core-schema.md)) that both web and native
reference. See the `[2026-05-30]` entry in [`decisions.md`](pdd/context/decisions.md) for why they're split.

## Documentation

- **[`docs/`](docs/)** — architecture overview, the knowledge graph, and screenshots
- **[Knowledge graph README](src/frontend/public/knowledge-graph/README.md)** — data model + features
- **[`pdd/`](pdd/)** — the full product brain

## Connect

Built by **Harshal Chourasiya**.

- GitHub: [@harshal2802](https://github.com/harshal2802) · [Snappet repo](https://github.com/harshal2802/Snappet)
- LinkedIn: [Harshal Chourasiya](https://www.linkedin.com/in/harshal-chourasiya-39bb0426)
