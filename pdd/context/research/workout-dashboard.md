# Research: Workout app — Dashboard tab

**Date**: 2026-05-28
**Outcome**: **Build** a Dashboard as a new first tab in the Workout app. Six sections, all inline SVG, all read-only over the existing `snappet:workout:history` blob. Reuse the per-exercise helpers already in `progress.ts` and `utils.ts`. Add date-bucketing helpers to a new `dashboard.ts`. Ship as one PR (Phase 6), no schema changes, ~700–900 LoC.

## Problem

After Phase 5 the workout app does five things well — Browse, Routines, run a session, see History, configure Settings. What it doesn't answer at a glance:

- "Am I on track this week?"
- "How consistent have I been lately?"
- "Is my volume trending up or down?"
- "Which muscle groups have I been ignoring?"
- "When was my last PR — and what was it?"
- "What's my actual go-to lift these days?"

History gives a chronological list; ExerciseDetail (post-Phase-5c) shows per-exercise progress. Neither answers the *cross-cutting* questions above. The user explicitly asked for a "detailed dashboard" with the work being deployable for morning review.

## Constraints (inherited)

- No backend; all data in `localStorage` (`snappet:workout:history`).
- No new dependencies; inline SVG for all charts (Snappet pattern, called out in original workout research).
- Mobile-first; one-thumb operation; tap targets ≥ 44 px; ≤ ~1.5 MB precache budget.
- No schema changes — read-only over existing `WorkoutSession[]`.

## Inventory of what's reusable

From the Phase 5 audit:

| Already exists | Where | Use for |
|---|---|---|
| `toKg(weight, unit)` | `progress.ts` | Any kg-normalised aggregation |
| `topSetForExercise`, `totalVolumeForExercise`, `sessionCountForExercise` | `progress.ts` | Per-exercise stats (PR feed, top-exercises) |
| `median`, `mode` | `utils.ts` | Reuse if useful (likely not — dashboard wants sums/counts, not medians) |
| `ExerciseProgress` (top-set bar chart + ★ PR marker) | `ExerciseProgress.tsx` | Pattern only — dashboard's charts are different shapes |
| `useLocalStorage` | shared hook | Persist time-range selector / collapsed sections |
| `ESSENTIAL_ID_SET` | `essentials.ts` | Not needed here |

What does **not** exist and needs building:

- Day / week / month bucketing of `WorkoutSession[]`
- Streak calculator (consecutive days with ≥1 completed session)
- Muscle-group volume aggregator (we have `Exercise.primaryMuscles` already — just need to bridge `SessionExercise.exerciseId` to that muscle list at aggregation time)
- Heatmap layout (7 × N SVG grid)
- Sparkline layout (single polyline + dot on current bucket)
- Horizontal-bar chart (muscle balance)

All of these are < 50 LoC each as inline functions / inline SVG.

## Section options evaluated (from design pass)

| # | Section | What it answers | Implementation cost |
|---|---|---|---|
| 1 | **Week Snapshot** (hero) — sessions this week vs last, volume this week vs last, current streak | "Am I on track now?" | Low — three scalars + one streak loop |
| 2 | **12-Week Heatmap** — 7×12 SVG grid, shade per session count | "How consistent lately?" | Low — bucket sessions by yyyy-mm-dd then plot |
| 3 | **Volume Sparkline** — weekly total kg-volume, last 12 weeks, dot on current | "Trending up or down?" | Low — bucket by ISO week, polyline |
| 4 | **Muscle Group Balance** — top 6 muscle groups by 30-day volume, horizontal bars | "Skipping legs again?" | Low — bridge exercise → muscle via `Exercise.primaryMuscles`; sum |
| 5 | **Recent PRs Feed** — last 5 distinct-exercise PRs with date + click-through to ExerciseDetail | "When did I last beat myself?" | Low — iterate history once per exercise via `topSetForExercise` |
| 6 | **Top Exercises by Frequency** — top 5 most-performed in last 30 days | "What's my go-to lift?" | Low — count by exerciseId, sort, slice |
| 7 | Session Quality — avg completion %, avg duration last 10 | "Am I bailing mid-workout?" | Low — but least motivational; skip first ship |

### Recommendation: ship 1–6, drop 7

The design agent's first-ship cut was 1/2/3/5. The argument for cutting 4 and 6 was that they're "diagnostic, not motivational" and that muscle-grouping needs new tagging infra.

I'm overriding the cut on two points:

- **Muscle balance is free**: `Exercise.primaryMuscles` is already in the dataset; no tagging needed. The bridge is `historySession.exerciseId → exerciseById.get(id).primaryMuscles`. ~30 LoC.
- **Frequency is the "is my training plan working" question** — pairs naturally with muscle balance. Cheap to add.

Cutting **Session Quality (7)** instead — it's a paper-cut diagnostic, can be added later. The user said "detailed", so 6 well-chosen sections is closer to the brief than 4.

## Sketch — Dashboard layout (mobile-first, vertical stack)

```
┌────────────────────────────────────────┐
│ Dashboard                              │
│ Your training, at a glance.            │
├────────────────────────────────────────┤
│ THIS WEEK                              │
│ ┌────────┬────────┬──────────────────┐ │
│ │ 3      │ 4,820  │ 🔥 5             │ │
│ │ sess.  │ kg vol │ day streak       │ │
│ │ ↑ +1   │ ↓ −340 │                  │ │
│ │ vs last│ vs last│                  │ │
│ └────────┴────────┴──────────────────┘ │
├────────────────────────────────────────┤
│ LAST 12 WEEKS · consistency            │
│ ░ ▒ ▓ █                                │
│ M ░ ░ ░ ▒ ▒ ░ ▒ ▒ ▓ █ ▒ ▒              │
│ T ░ ▒ ░ ░ ▒ ▒ ▒ ▒ ▒ ▒ ▓ ▒              │
│ W ░ ░ ▒ ▒ ░ ▒ ▒ ▓ ▒ ▒ ▒ ░              │
│ T ░ ▒ ░ ▒ ▒ ░ ▒ ▒ ░ ▒ ▒ ░              │
│ F ░ ░ ▒ ░ ░ ▒ ▒ ▒ ▒ ▒ ░ ▒              │
│ S ░ ░ ░ ▒ ▒ ▒ ▒ ▒ ▒ ░ ▒ ░              │
│ S ░ ░ ░ ░ ░ ▒ ▒ ░ ▒ ▒ ▒ ░              │
│   Mar       Apr       May              │
├────────────────────────────────────────┤
│ VOLUME (kg) · last 12 weeks            │
│        •                               │
│       ╱ ╲       •                      │
│      •   ╲   • ╱                       │
│   • ╱     •─•                          │
│  ╱                                     │
│ Mar         Apr         May            │
├────────────────────────────────────────┤
│ MUSCLE BALANCE · last 30 days          │
│ chest      ████████████  3,200 kg      │
│ back       █████████     2,400 kg      │
│ quadriceps ██████        1,600 kg      │
│ glutes     ████          1,100 kg      │
│ shoulders  ███             800 kg      │
│ triceps    ██              500 kg      │
├────────────────────────────────────────┤
│ RECENT PRs                             │
│ ★ Bench Press        100 kg × 5  May 22│
│ ★ Barbell Squat      120 kg × 5  May 19│
│ ★ Pullups             0 kg × 12  May 16│
│ ★ Deadlift           140 kg × 3  May 14│
│ ★ Dumbbell Press      32 kg × 8  May 10│
├────────────────────────────────────────┤
│ TOP EXERCISES · last 30 days           │
│ Bench Press         8 sessions         │
│ Barbell Squat       7 sessions         │
│ Pullups             6 sessions         │
│ Deadlift            5 sessions         │
│ Dumbbell Row        4 sessions         │
└────────────────────────────────────────┘
```

## Placement

New **Dashboard** tab as the first tab, default landing for new users:

```ts
type Tab = 'dashboard' | 'browse' | 'routines' | 'history' | 'settings'
const DEFAULT_TAB: Tab = 'dashboard'
```

Existing users with a saved `snappet:workout:tab` value keep their current tab; only fresh installs land on Dashboard. That's the right default — new users see "no data yet" with a friendly nudge to start a routine.

## Empty state

When `history.length === 0`:

```
┌────────────────────────────────────────┐
│ Dashboard                              │
├────────────────────────────────────────┤
│ 📊                                     │
│ No workouts yet                        │
│                                        │
│ Complete a routine and your dashboard │
│ will fill in. Start with a starter    │
│ or build your own in Routines.        │
│                                        │
│ [ Go to Routines ]                    │
└────────────────────────────────────────┘
```

## Time ranges

Per-section windows (no global selector — adds nav weight for marginal benefit at this stage):

- Week snapshot: this calendar week (Mon–Sun) vs previous calendar week
- Heatmap: last 12 ISO weeks (today − 83 days through today, rounded to week boundaries)
- Volume sparkline: last 12 ISO weeks (same buckets as heatmap)
- Muscle balance: last 30 days
- PR feed: all-time top per exercise, top 5 by recency
- Frequency: last 30 days

A future iteration can add a global toggle (7d / 30d / 90d / all-time) if the team wants it.

## Effort

Single PR. Estimated:
- `dashboard.ts` (helpers): ~150 LoC
- `Dashboard.tsx` (orchestrator): ~80 LoC
- 6 sub-components (one per widget): ~80 LoC each = ~480 LoC
- `index.tsx` wiring: ~20 LoC
- Prompt + decision log: ~250 LoC of docs

Total ~750 code LoC + ~250 docs. Comparable to a Phase 5 sub-PR.

## Rejected alternatives (logged)

- **Recharts / Visx / nivo**: violates "no new deps". Inline SVG is the established pattern.
- **One global time-range selector**: each section is most useful with its natural window. A global toggle complicates the UI without proportional value.
- **Replace the History tab with Dashboard**: History is still useful for "show me what happened in *that* session"; merging would conflate two distinct user tasks.
- **Make Dashboard a modal over Browse**: tabs are already established; another navigation pattern adds cognitive load.
- **Defer muscle balance to Phase 7**: data is already available — no reason to defer.

## Open questions for the user

1. **Default tab for *existing* users**: keep their saved `tab` (recommended — no surprise migration), or force-reset to `dashboard` on first load post-update? Recommend keep.
2. **Heatmap shading scale**: 0 / 1 / 2+ sessions per day? Or finer (0 / 1 / 2 / 3+)? Default: 0 / 1 / 2 / 3+ (4 buckets, GitHub style).
3. **Sparkline y-axis labels**: hide entirely (cleaner) or show min/max gridlines? Default: hide; show value on the current-week dot only.

## Next step

`/pdd-plan` → add Phase 6 to `PLAN-workout-app.md`. Then `/pdd-prompts` for `32-workout-06-dashboard.md`. Then implement, review, PR.
