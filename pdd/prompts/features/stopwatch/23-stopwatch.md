# Prompt: Stopwatch + Lap Timer

**File**: pdd/prompts/features/stopwatch/23-stopwatch.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: 5-app mobile-friendly brainstorm in pdd/context/research/mobile-friendly-app-ideas.md (candidate #3)
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps, installable as a PWA on iPhone and Android. This is the **Stopwatch + Lap Timer** at `/stopwatch` — ad-hoc timing for workouts, cooking, intervals, debate rebuttals. Different mental model from Pomodoro (which is for fixed focus blocks). Big Start / Stop / Lap buttons sized for the thumb.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies — pure React state + the existing `useLocalStorage` hook + optional `navigator.vibrate` for haptic feedback.

## Task

A single-file mini-app that times to centisecond precision and records lap splits.

1. **Big timer display** — `MM:SS.cc` format, monospace, tabular-nums, `text-7xl`. For totals ≥ 1 hour, format as `HH:MM:SS.cc`.
2. **Start / Stop / Lap / Resume / Reset** buttons, all thumb-sized (`h-14` or larger), single-row.
3. **Lap list** — each entry shows lap number, split (this lap's duration), and total elapsed at the lap moment. Newest at top. Best split highlighted green; worst split highlighted red (only when ≥ 3 laps).
4. **Survives refresh mid-run** — the timer keeps counting through a page reload because elapsed is always derived from `Date.now() - startedAt`, never from a stored counter.
5. **Optional haptic** — `navigator.vibrate?.(10)` on Start / Stop / Lap.

## Drift-free timing (CRITICAL)

**Never decrement or increment a stored counter.** That accumulates rounding error and drifts during background tabs / sleeping screens. Instead, store `startedAt: number | null` (epoch ms) and `elapsedAtPause: number`, and derive the current elapsed every render:

```ts
const currentElapsed = state.startedAt !== null
  ? state.elapsedAtPause + (Date.now() - state.startedAt)
  : state.elapsedAtPause
```

This is the same drift-free pattern used by the Pomodoro Timer (`apps/pomodoro-timer/index.tsx`) — refer to it for the exact shape of the start/pause math.

A `setInterval(() => setNow(Date.now()), 31)` tick (only while running) just forces re-renders so the centiseconds update — the interval **does not produce the value**, it only triggers a re-read of `Date.now()`. ~31 ms (~32 fps) is slightly faster than 60fps for smooth centisecond rollover without being wasteful.

## State

Persisted under `snappet:stopwatch:state`:

```ts
interface State {
  startedAt: number | null   // epoch ms; non-null = running
  elapsedAtPause: number     // ms accumulated while paused
  laps: number[]             // each entry is total elapsed (ms) at lap moment
}
```

Transitions:

- **Start** (from stopped): `startedAt = Date.now()` (elapsedAtPause stays 0)
- **Resume** (from paused): `startedAt = Date.now()` (elapsedAtPause keeps its value — the derivation handles the rest)
- **Stop / Pause** (from running): `elapsedAtPause += Date.now() - startedAt; startedAt = null`
- **Reset**: `startedAt = null; elapsedAtPause = 0; laps = []`
- **Lap** (only while running): `laps.push(currentElapsed)`

Button visibility:

- Stopped (`startedAt === null && elapsedAtPause === 0`) → single **Start** button
- Running (`startedAt !== null`) → **Lap** (secondary) + **Stop** (primary)
- Paused (`startedAt === null && elapsedAtPause > 0`) → **Reset** (secondary) + **Resume** (primary)

## Output format

### 1. `src/frontend/apps/stopwatch/index.tsx`

Default-exported `Stopwatch` component. Layout (`max-w-md mx-auto space-y-4`):

- Standard header row (title "Stopwatch" + subtitle), matches Pomodoro / Tally header styling.
- Big timer display, centered, `text-7xl font-mono tabular-nums`.
- Buttons row — thumb-sized, gap-3, full row.
- Lap list — scrolling card if many laps. Each row: lap number on the left, total on the right, split below or aligned. Best split: `text-green-600 dark:text-green-400`. Worst split (when ≥ 3 laps): `text-red-600 dark:text-red-400`.

Helper:

```ts
function formatTime(ms: number): string  // 'MM:SS.cc' or 'HH:MM:SS.cc' when ≥ 1 hour
```

Centiseconds: `Math.floor((ms % 1000) / 10)`, zero-padded to 2 digits.

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/stopwatch',
  label: 'Stopwatch',
  description: 'Time anything with lap splits — workouts, cooking, intervals.',
  category: 'Productivity',
  icon: '⏱️',
  component: lazy(() => import('../apps/stopwatch')),
},
```

## Acceptance criteria

- [ ] Start makes the timer count up smoothly at centisecond resolution
- [ ] Stop freezes the display at the current elapsed
- [ ] Resume continues from the frozen elapsed without skipping or doubling
- [ ] Lap records a split; splits sum to the total elapsed (within centisecond rounding)
- [ ] Best split highlighted green; worst split highlighted red (only when ≥ 3 laps)
- [ ] Refreshing the page mid-run keeps counting (state is rehydrated and `Date.now()` re-derived)
- [ ] Reset clears the timer and lap list to the initial state
- [ ] Works on mobile (375px); buttons reachable with one thumb
- [ ] Dark mode + focus-visible rings on all buttons
- [ ] `tabular-nums` on the digits so they don't jiggle as values change
- [ ] Optional haptic on Start / Stop / Lap (no-op if unsupported)
- [ ] No `any`; strict TypeScript clean

## Constraints

- TypeScript strict; no `any`
- **Never decrement/increment a stored counter** — always derive elapsed from `Date.now() - startedAt`
- Tailwind only — no inline styles, no CSS-in-JS
- Single file under `apps/stopwatch/index.tsx`
- Use `useLocalStorage` for persistence — do not roll a new hook
- Clear the tick interval on pause / reset / unmount so we don't burn CPU when stopped
- Functional component with hooks only
