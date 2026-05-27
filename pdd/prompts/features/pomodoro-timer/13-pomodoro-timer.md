# Prompt: Pomodoro Timer

**File**: pdd/prompts/features/pomodoro-timer/13-pomodoro-timer.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: GitHub issue #6
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Pomodoro Timer mini-app at `/pomodoro-timer`. It implements the classic Pomodoro technique: 25-minute work sessions interleaved with 5-minute short breaks and a 15-minute long break every 4 work sessions.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies — uses the browser `Notification` API and `setInterval`.

## Task

A single-file mini-app that:

1. **Three phases**: `work` (25 min), `short-break` (5 min), `long-break` (15 min). Cycle: `work → short-break → work → … → work → long-break → repeat`. Long break triggers after the 4th work session completes.
2. **Visual progress ring** — SVG circle, stroke offset shrinks as the phase progresses. Smooth animation.
3. **Session counter** — visible "Session N of 4" indicator showing progress toward the next long break.
4. **Browser notification** when a phase ends — requests permission on first Start; if denied, falls back to a brief in-app banner.
5. **Controls**: Start / Pause / Skip / Reset (matching the project's button styling).
6. **Survives refresh mid-session** — see "Persistence" below.

## Persistence model

State stored under `snappet:pomodoro:state` as:
```ts
interface TimerState {
  phase: 'work' | 'short-break' | 'long-break'
  completedWorkSessions: number   // 0..3, triggers long break at 4
  startedAt: number | null        // epoch ms when current phase started running
  pausedRemainingMs: number | null // remaining when paused; null while running
}
```

Source-of-truth math:
- **Running**: `remaining = phaseDuration - (now - startedAt)`. If `<= 0`, the phase ended while the user was away — on mount, auto-advance to the next phase (and fire the notification if permission is granted), then pause in the new phase so the user starts it manually.
- **Paused**: `remaining = pausedRemainingMs`
- **Pause** writes `pausedRemainingMs = currentRemaining`; clears `startedAt`
- **Resume** writes `startedAt = now - (phaseDuration - pausedRemainingMs)`; clears `pausedRemainingMs`

A `setInterval(…, 250)` re-reads `Date.now()` to update the displayed remaining time — never decrements a counter directly, so drift is impossible even if the tab is throttled.

## Output format

### 1. `src/frontend/apps/pomodoro-timer/index.tsx`

Default-exported `PomodoroTimer` component, single file. Includes a small inline `ProgressRing` component (SVG with two circles — background + foreground with `stroke-dasharray` / `stroke-dashoffset`).

Layout (`max-w-md mx-auto space-y-6`):
- Header row: title + description, Reset button (consistent with other mini-apps)
- Phase label card: "Work" / "Short Break" / "Long Break" with a colored dot per phase
- Centered progress ring (~240×240 px) with the remaining time as `MM:SS` in the middle
- Button row: Start/Pause (toggle), Skip
- Session pips under the controls: 4 small circles, filled to indicate `completedWorkSessions`
- "Notification permission" inline note when permission is `default` (a one-line "Allow notifications to be alerted when a phase ends.")

Colors per phase (use static Tailwind classes so the content scanner finds them):
- work: red-500 / red-400 in dark mode
- short-break: green-500 / green-400
- long-break: blue-500 / blue-400

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/pomodoro-timer',
  label: 'Pomodoro Timer',
  description: 'Focus timer with 25-min work sessions and short/long breaks.',
  category: 'Productivity',
  icon: '🍅',
  component: lazy(() => import('../apps/pomodoro-timer')),
}
```

## Acceptance criteria (from issue #6)

- [ ] Timer counts down accurately
- [ ] Cycles correctly: work → short break → work → ... → long break
- [ ] Browser notification fires when session ends (with permission request)
- [ ] State survives page refresh mid-session
- [ ] Reset button clears back to first work session
- [ ] Works on mobile (375px)
- [ ] Dark mode support

## Constraints

- Never derive remaining time by decrementing a stored counter — always compute from `Date.now() - startedAt`. The tick interval is purely for re-rendering, not for advancing state.
- `setInterval` cleared in the effect's cleanup.
- Notification permission requested only when the user clicks Start (browser policy: a user gesture).
- If notifications are denied, show a brief on-page banner instead — never spam.
- No `any`.
- All custom controls need `dark:` variants and `focus-visible:` rings.
