# Decisions: Snappet

**Last updated**: 2026-05-28

A log of significant technical decisions and the reasoning behind them.

---

## [2026-05-29] Hub: local-only usage tracking → popularity sort + dashboard

**Decision**: The hub tracks how often each tool is opened **on the user's own device**
(`localStorage` key `snappet:usage:v1`, `{ count, last }` per path), recorded on navigation
in `App.tsx`. The hub sorts by **Popular** (count) / Recent / A–Z (default Popular, persisted
in `snappet:hub:sort`), shows a per-card open-count badge, and renders a **Dashboard** panel
(total opens, tools-used-of-N, Most used with mini bars, Recently used, Reset stats). Source
of truth `lib/usage.ts`.

**Why**: User wanted a centralized dashboard with apps sorted by popularity. With no backend
(see "No backend, fully client-side"), global cross-user popularity is impossible, so
"popularity" = the individual's own usage — which is also the more useful personalization.

**Trade-offs / scope of "no analytics"**: This is **on-device only** — counts never leave the
browser and nothing is transmitted, so it does not violate the no-analytics/privacy stance;
it is personal state like other localStorage prefs. Cleared via the dashboard's Reset (and by
clearing site data). Not synced across devices.

**Don't suggest**: server-side or third-party analytics to compute popularity; sending usage
anywhere.

## [2026-05-28] Video editor: extract codec description via mp4box's `DataStream` (imported, not global)

**Decision**: To configure a `VideoDecoder`, the avcC/hvcC codec description bytes are
extracted by serializing the parsed mp4box box with `new DataStream(undefined, 0, DataStream.BIG_ENDIAN)`
and stripping the 8-byte box header (`.slice(8)`). `DataStream` is **imported from `'mp4box'`**,
not read from `globalThis`. On a decoder seek, always reconfigure with the track's **real**
codec string (`entry.codec`), never a hardcoded `avc1.*`.

**Why**: The MVP's `extractDescription` read `globalThis.DataStream`, which mp4box's UMD bundle
never assigns (it only does `exports.DataStream = …`). So the description was always `undefined`,
and `VideoDecoder.configure` for AVCC/HVCC streams silently produced no frames — proxy generation,
preview, and export were all broken. Separately, the seek path hardcoded `avc1.…`, so HEVC
originals (the iPhone default) failed to export. Both are fixed.

**How to apply**: Any WebCodecs decode path that demuxes with mp4box must import `DataStream`
and pass the track's actual codec to `configure`. Guard: if the description can't be read for an
`avc1/avc3/hvc1/hev1` track, fail loudly rather than emitting a blank proxy.

**Don't suggest**: Relying on `globalThis.DataStream`; assuming all input is H.264.

---

## [2026-05-28] Video editor: synchronous WebCodecs output callbacks + captured error state

**Decision**: `VideoDecoder`/`VideoEncoder` output callbacks must be **synchronous** (no `await`
inside). Backpressure is applied in the sample-feed loop on `decodeQueueSize`/`encodeQueueSize`.
Codec `error` callbacks store the error in a captured variable that is rethrown at the next
`await` point — they never `throw` from inside the callback.

**Why**: WebCodecs does not await an async output callback between frames, so awaiting inside lets
the next frame's callback interleave — racing on the shared compositing canvas and frame counter,
which corrupts pixels and emits out-of-order timestamps the encoder rejects. And `throw` inside an
error callback runs on a separate task, so it can't reject the orchestrating promise (the pipeline
hangs). Capture-and-rethrow surfaces a clean error.

**Don't suggest**: `async` output callbacks; throwing from a WebCodecs `error` callback.

## [2026-05-28] Workout app Phase 6: Dashboard tab

**Decision**: Ship a Dashboard as a new first tab in the workout app — six sections answering "now / lately / trend / balance / progress / habit". Sections: **WeekSnapshot** (sessions/volume/streak this-week vs last-week), **ConsistencyHeatmap** (7×12 grid, 4-step shading), **VolumeSparkline** (12-week kg-volume line), **MuscleBalance** (top-6 muscles by 30-day volume), **RecentPRs** (last 5 distinct-exercise PRs, tap-through to ExerciseDetail), **TopExercises** (top-5 by 30-day frequency). All inline SVG, no new dependencies. Read-only over `snappet:workout:history` — zero schema changes. Default tab for fresh installs; existing users keep their saved tab. Full analysis in `pdd/context/research/workout-dashboard.md`.

**Why**: Phase 5 closed the per-exercise gap (ExerciseDetail Progress section), but cross-cutting questions (consistency, trend, muscle balance) had no home. A single dashboard tab puts them all in one scroll. Six sections matches the user's brief ("detailed dashboard") without bloating into a 1,500-LoC PR. Muscle balance is *free* — `Exercise.primaryMuscles` is already in the dataset, no tagging infra needed.

**Trade-offs**: Five tabs (Dashboard / Browse / Routines / History / Settings) is the most this segmented-control will hold comfortably on a 360 px phone — pushing further would force a hamburger or bottom-nav redesign. Session Quality (avg completion %, avg duration) deferred to a hypothetical Phase 7 — diagnostic value but not motivational. Muscle-volume math splits weight evenly across `primaryMuscles` per set: approximate (a Bench Press 100% to chest is closer to truth than a 50/50 chest/triceps split would be), but predictable, dependency-free, and good enough as a "what am I neglecting" signal.

**Don't suggest**: Adding Recharts / Visx (violates no-deps); making Dashboard a modal over Browse (extra navigation pattern); replacing History with Dashboard (they answer different questions); a global time-range selector (per-section windows are more legible); per-set muscle apportioning (compound lift biomechanics get complicated fast — `primaryMuscles` split is the right level of approximation).

---

## [2026-05-28] Workout app Phase 5: round-one feedback chain

**Decision**: Address user feedback (issue #38) as a 3-PR Phase 5 chain. **5a** ships smarter search (token + stem matcher), sticky weight unit via `snappet:workout:preferred-unit`, in-routine exercise rename (`RoutineExercise.displayName`), and a new fourth **Settings** tab. **5b** adds `Routine.defaults` with auto-derived values for existing routines + an apply-to-all affordance. **5c** ships a curated Essentials list of **100** exercises (default browser view) and promotes `ExerciseProgress` into `ExerciseDetail` with a three-card stat panel + PR marker. Full research in `pdd/context/research/workout-app-feedback.md`.

**Why**: Five concrete usability issues, each cheap to fix and independently shippable. Single mega-PR would be reviewable but a chain matches the original workout app's per-phase shipping cadence and lets the maintainer ship incremental value.

**Trade-offs**: `Routine.defaults` migration is auto-derived on first read (median sets, mode reps, median rest, mode unit) — slightly opinionated but predictable; existing routines see no behaviour change because defaults only apply to *new* exercise picks. Essentials at 100 deliberately hides 700 long-tail entries by default; power users toggle "Show all 800". The 4th Settings tab adds nav weight but leaves room to grow (rest sound, vibration, theme).

**Don't suggest**: Adding Fuse.js for fuzzy search (token+stem covers the reported case without the dep); a separate Progress top-level tab (deep-link from history into ExerciseDetail covers the same need); per-routine migration prompts (silent auto-derive is less friction).

---

## [2026-05-27] Workout app: Free Exercise DB + 4-phase prompt chain

**Decision**: Build a Workout mini-app as a 4-phase prompt chain (Browser → Routine Builder → Workout Player → History). Data source: [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) — bundle the ~1 MB `exercises.json` (all 800 exercises) at build; lazy-load images from jsdelivr CDN. Default weight unit: kg. Rest-timer end cue: vibration + visual flash + short Web Audio beep. Full analysis in `pdd/context/research/workout-app.md`.

**Why**: Largest single feature in Snappet — chaining keeps each PR review-able. Free Exercise DB is the only open-source option that gives us all three of: no API key, offline-bundlable metadata, predictable image URLs. wger (license + complexity) and ExerciseDB-RapidAPI (paid + key) both fail Snappet's no-backend constraint.

**Trade-offs**: Image rights derive from older sources (project README says "free to use") — must include visible attribution to Free Exercise DB. ~60 MB of images means we intentionally don't precache them; users need online for the first view of each exercise (then HTTP cache covers repeat views).

**Don't suggest**: A single mega-prompt for the whole app (too large for one PR); wger API integration (license + complexity); ExerciseDB/RapidAPI (paid + API key); auto-curating Wikimedia images (rights mess); a backend (violates no-backend ethos).

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
