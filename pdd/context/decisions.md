# Decisions: Snappet

**Last updated**: 2026-03-29

A log of significant technical decisions and the reasoning behind them.

---

## [2026-03-29] React Router BrowserRouter with GitHub Pages 404 redirect

**Decision**: Use React Router v6 with `BrowserRouter` (clean URLs) instead of `HashRouter`.
**Why**: Each mini-app should have a clean, shareable URL (e.g. `/tip-calculator`). Hash URLs (`/#/tip-calculator`) work but look unprofessional for a polished tool hub.
**Trade-offs**: Requires copying `index.html` as `404.html` in the GitHub Actions build step so GitHub Pages doesn't 404 on direct navigation or refresh. Small one-time cost.
**Don't suggest**: Switching to HashRouter to avoid the 404 setup — the clean URL experience is worth it.

---

## [2026-03-29] Tailwind CSS for styling

**Decision**: Use Tailwind CSS as the sole styling system.
**Why**: Needed dark mode support (built-in `dark:` variant), full responsiveness (built-in breakpoints), and fast consistent UI across many mini-apps. Utility-first approach avoids style drift across apps.
**Trade-offs**: Verbose class strings in JSX. Acceptable given the productivity gain.
**Don't suggest**: MUI, Ant Design, Chakra, or other component libraries — they add significant bundle weight and override flexibility.

---

## [2026-03-29] No backend, fully client-side

**Decision**: Every mini-app runs entirely in the browser. No API server, no database.
**Why**: Simplicity, zero hosting cost, no auth surface, instant load. The tools don't need server state.
**Trade-offs**: Can't do anything that requires secrets, server computation, or persistent multi-user state. Acceptable — these are utility tools.
**Don't suggest**: Adding a backend for features that can reasonably run client-side.

---

## [2026-03-29] One folder per mini-app under `src/apps/`

**Decision**: Each mini-app lives in its own folder under `src/apps/` with its own `index.tsx` and optional `components/` subfolder.
**Why**: Keeps apps isolated, easy to add or remove without touching shared code. Clear ownership boundary.
**Don't suggest**: Mixing all app components into a flat `src/components/` directory.
