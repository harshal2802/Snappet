# Decisions: Snappet

**Last updated**: 2026-05-27

A log of significant technical decisions and the reasoning behind them.

---

## [2026-05-27] Five new mobile-friendly mini-apps

**Decision**: Build all 5 candidates from `research/mobile-friendly-app-ideas.md` in parallel, one PR each: QR Code Generator (#20), Tally Counter (#21), Random Picker (#22), Stopwatch + Lap Timer (#23), Unit Converter (#24). Each ships as its own branch + PDD prompt + PR following the established per-app pattern. The numeric prefixes continue the existing prompt-file sequence (last was `19-touch-multi-select.md`).
**Why**: Snappet is now genuinely usable on iPhone post PR #22–#24. These 5 are the highest-impact mobile-native additions identified in research. Per-PR matches every prior mini-app (#1–#20 from issues).
**Trade-offs**: Five parallel branches means each needs a rebase as the others merge (routes.tsx is the contended file). Manageable — only one app (QR) adds an npm dep, the rest are pure code.
**Don't suggest**: Bundling into one big "more apps" PR; rejecting alternatives (Habit Tracker, Drawing Pad, Voice Recorder, Hash/Base64/JWT, Barcode Scanner) logged in the research file.

---

## [2026-05-27] Touch multi-word selection in OcrTextView: long-press → drag

**Decision**: Implement Option 1 from `research/touch-multi-select.md`. Pressing and holding a word for 300 ms enters extend mode; finger drag across words extends via `document.elementFromPoint`; lifting commits. Short tap stays single-select; short drag still scrolls. Mirrors iOS native text-selection vocabulary.
**Why**: Most familiar gesture for iOS users, doesn't conflict with scrolling, and reuses the existing `dragAnchorRef` + `rangeBetween` selection machinery. PR #23 explicitly deferred this with the v1 punt — user has now confirmed it's a real need.
**Trade-offs**: Discoverability — the gesture isn't shown anywhere by default. Mitigated by updating the mobile tip line. Requires `-webkit-touch-callout: none` to suppress iOS's copy/share popup on long-press, and `touch-action: none` only-while-in-extend-mode to keep the browser from stealing pointermove for scroll.
**Don't suggest**: A persistent "extend mode" toggle button (modal UI, easy to forget); iOS-style draggable handles (200+ LoC, brittle to text wrap); pure drag-from-word (breaks panel scrolling).

---

## [2026-05-27] PWA via `vite-plugin-pwa` in `generateSW` mode

**Decision**: Make Snappet a Progressive Web App using `vite-plugin-pwa` (the first-party Vite plugin built on Workbox) in its default `generateSW` mode. Precache the build manifest (HTML + hashed JS chunks + CSS + icons), fall back to `index.html` for SPA navigation, expose an in-app "Update available" prompt via `useRegisterSW` from `virtual:pwa-register/react`. Full analysis in `pdd/context/research/pwa-support.md`.
**Why**: We don't need a custom service worker — defaults match what we need (offline shell, hashed-chunk precache, GitHub-Pages base path support). The plugin handles the SW lifecycle correctly, which is what bites every hand-rolled SW. Adopting it avoids ~200 lines of error-prone code.
**Trade-offs**: One more dev dependency. The Document Viewer's CDN-loaded tesseract.js core (~3 MB) and eng language model (~10 MB) are **not** precached — too large for an installable bundle. They fall back to the browser's HTTP cache, which means Document Viewer's OCR feature requires online for the first use per machine.
**Don't suggest**: Hand-writing a service worker, using workbox-cli directly, or bundling tesseract.js's WASM/traineddata into the precache.

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

## [2026-03-29] One folder per mini-app under `src/frontend/apps/`

**Decision**: Each mini-app lives in its own folder under `src/frontend/apps/` with its own `index.tsx` and optional sub-files (`types.ts`, `utils.ts`, component files).
**Why**: Keeps apps isolated, easy to add or remove without touching shared code. Clear ownership boundary.
**Don't suggest**: Mixing all app components into a flat `src/components/` directory.

---

## [2026-03-30] localStorage persistence via shared `useLocalStorage` hook

**Decision**: All user-facing state in every mini-app is persisted to localStorage via a shared `useLocalStorage` hook at `src/frontend/hooks/useLocalStorage.ts`. Keys follow `snappet:<app-slug>:<field>`.
**Why**: Users lose their work on refresh — especially painful in the Expense Splitter with multiple entries. A single reusable hook avoids re-implementing the pattern per app.
**Trade-offs**: Stale localStorage data could conflict if state shape changes. Mitigated by try/catch in the hook (falls back to default on parse failure).
**Don't suggest**: Per-app ad-hoc `useEffect` + `localStorage` patterns — use the shared hook.

---

## [2026-03-30] Reset button on every mini-app

**Decision**: Every mini-app has an `↺ Reset` button in the top-right of its header that restores all state to defaults with fresh IDs.
**Why**: localStorage persistence means stale data accumulates. Users need an escape hatch to start clean without knowing about DevTools.
**Don't suggest**: Confirmation dialogs before reset — the action is easily reversible by re-entering data, and dialogs add friction.

---

## [2026-03-30] Branch per feature + PR workflow

**Decision**: Every new mini-app or feature is developed on a dedicated branch (`feat/<name>`) and merged via PR to `main`. Never commit feature work directly to `main`.
**Why**: Provides a review gate for AI-generated code before it deploys. Keeps `main` always deployable.
**Don't suggest**: Committing directly to `main` for anything beyond hotfixes.
