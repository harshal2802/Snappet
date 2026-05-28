# Prompt: Workout app — Phase 3: Workout Player

**File**: pdd/prompts/features/workout/27-workout-03-player.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Chain**: 3 of 4 — depends on Phases 1 and 2 being merged
**Plan**: `pdd/prompts/features/workout/PLAN-workout-app.md`
**Depends on**:
- Phase 1 (PR #30): catalog data, ExerciseImage, ExerciseDetail
- Phase 2 (PR #31): Routine + RoutineExercise types, RoutineList with optional onStart

## Context

Phase 2 shipped routines (planner). Phase 3 turns the routine into a *session* you can actually run at the gym/in the living room: full-screen takeover, one exercise at a time, big tap targets for "Complete set", rest timer with vibration + screen flash + audio beep, Wake Lock to keep the screen on. Refresh mid-session restores you to where you were. On completion, the session is archived for Phase 4's history view.

**Stack**: React 18, TypeScript (strict), Tailwind CSS. No new runtime deps. Uses browser APIs: `setInterval`, `Date.now`, `AudioContext`, `navigator.wakeLock`, `navigator.vibrate`.

**Existing from Phase 2**:
- `src/frontend/apps/workout/types.ts` — `Routine`, `RoutineExercise`, `WeightUnit`
- `src/frontend/apps/workout/index.tsx` — orchestrator with tabs + `<RoutinesView>` (its `RoutineList` already accepts an optional `onStart` — Phase 3 wires it)
- `src/frontend/apps/workout/RoutineList.tsx` — Start button hidden when `onStart` undefined
- `src/frontend/apps/workout/utils.ts` — `generateId()`

## Architecture

```
index.tsx (orchestrator)
├── persisted: tab, routines, startersSeeded, activeSession (new), history (new)
└── if activeSession: render <WorkoutPlayer> (full-screen takeover, hides tabs)
   else: render header + tabs + body as today

RoutinesView
└── onStart={(routineId) => createSessionFromRoutine(routineId); setActiveSession(s)}

WorkoutPlayer.tsx — full-screen 'fixed inset-0 top-[57px] flex flex-col'
├── persisted via parent: session (incrementally updated as sets complete)
├── transient: phase ('exercise' | 'rest' | 'done'), restEndsAt, audioCtx
├── effects: wake lock acquire/release/reacquire-on-visibility
└── sub-components
    ├── ExerciseStep — image, name, instructions toggle, current-set inputs
    ├── RestStep — countdown ring + skip
    └── DoneScreen — summary + Save/exit
```

## Output format

### 1. `src/frontend/apps/workout/types.ts` (extend)

Append (do not modify existing):

```ts
// ── Phase 3: Sessions ───────────────────────────────────────────────────────

export interface SetLog {
  // Actual reps performed; undefined = set not completed
  actualReps?: number
  // Actual weight; optional (bodyweight or skipped logging)
  actualWeight?: number
  weightUnit?: WeightUnit
  completedAt?: number
}

export interface SessionExercise {
  exerciseId: string
  // Snapshot of the routine's target at session-start time so routine edits
  // mid-session don't corrupt the active log.
  targetSets: number
  targetReps: string
  targetRestSeconds: number
  targetWeight?: number
  targetWeightUnit?: WeightUnit
  // Length always === targetSets. Empty {} = pending; populated = completed.
  sets: SetLog[]
  // True if the user explicitly skipped this exercise.
  skipped?: boolean
}

export interface WorkoutSession {
  id: string
  routineId: string
  // Snapshot — routine may be renamed/deleted after session starts.
  routineName: string
  startedAt: number
  // Set when user taps "Finish" or all sets complete naturally.
  completedAt?: number
  exercises: SessionExercise[]
}
```

### 2. `src/frontend/apps/workout/index.tsx` (extend)

Add session + history state at the orchestrator:

```ts
const [activeSession, setActiveSession] = useLocalStorage<WorkoutSession | null>(
  'snappet:workout:active-session',
  null,
)
const [history, setHistory] = useLocalStorage<WorkoutSession[]>(
  'snappet:workout:history',
  [],
)
```

Wire `onStart` in `RoutinesView` (Phase 2 stubbed this out):

```ts
function handleStart(routineId: string) {
  const r = routines.find((x) => x.id === routineId)
  if (!r || r.exercises.length === 0) return
  const session: WorkoutSession = {
    id: generateId(),
    routineId: r.id,
    routineName: r.name,
    startedAt: Date.now(),
    exercises: r.exercises.map((re) => ({
      exerciseId: re.exerciseId,
      targetSets: re.sets,
      targetReps: re.reps,
      targetRestSeconds: re.restSeconds,
      targetWeight: re.weight,
      targetWeightUnit: re.weightUnit,
      sets: Array.from({ length: re.sets }, () => ({} as SetLog)),
    })),
  }
  setActiveSession(session)
}
// pass onStart={handleStart} to <RoutineList ...>
```

At the top of the default `Workout` component (after the loading effects), branch on `activeSession`:

```tsx
if (activeSession) {
  return (
    <WorkoutPlayer
      session={activeSession}
      setSession={setActiveSession}
      exerciseById={exerciseById}
      onFinish={(final) => {
        setHistory((h) => [final, ...h])
        setActiveSession(null)
      }}
      onAbandon={() => setActiveSession(null)}
    />
  )
}

// otherwise existing header + tabs + body as today
```

`setActiveSession` as the persistence sink means every incremental update (each set completed) is written to localStorage. The Player calls it through; the orchestrator doesn't need session-specific logic.

### 3. `src/frontend/apps/workout/WorkoutPlayer.tsx` (new)

Full-screen takeover. Layout matches doc-viewer's pattern:

```tsx
return (
  <div className="fixed inset-0 top-[57px] flex flex-col bg-white dark:bg-gray-900">
    {/* top bar */}
    {/* current step (ExerciseStep | RestStep | DoneScreen) */}
  </div>
)
```

Props:
```ts
interface WorkoutPlayerProps {
  session: WorkoutSession
  setSession: (updater: WorkoutSession | ((s: WorkoutSession | null) => WorkoutSession | null)) => void
  exerciseById: Map<string, Exercise>
  onFinish: (finalSession: WorkoutSession) => void
  onAbandon: () => void
}
```

State:
```ts
type Phase = 'exercise' | 'rest' | 'done'
const [phase, setPhase] = useState<Phase>(deriveInitialPhase(session))
const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
const [now, setNow] = useState(() => Date.now())
const audioCtxRef = useRef<AudioContext | null>(null)
const flashRef = useRef(false) // imperatively trigger a visual flash via a CSS animation
```

Derived:
- `currentExerciseIdx`: first index where `!skipped && sets.some(s => !s.completedAt)`, or last if all done
- `currentSetIdx`: first index of `sets` for current exercise where `!completedAt`
- `isLastSetOfLastExercise`: when on the final pending set; "Complete set" becomes "Finish workout"

#### Top bar

- Routine name on the left (truncated), exercise count progress ("Exercise 2 of 5") under it
- "End workout" button on the right → opens an inline confirm dialog
- Linear progress bar across the top (total sets completed / total target sets across all exercises)

#### `phase === 'exercise'` (ExerciseStep inline)

- Big exercise image (40vh max-height, contained, jsdelivr lazy load via `<ExerciseImage>`)
- Exercise name (text-2xl) + target line: `{targetSets} × {targetReps}{weight ? ` @ ${weight}${weightUnit}` : ''}, ${restSeconds}s rest`
- Set pips row: dots for each set, filled = completed, current = ring, pending = empty
- Inputs side-by-side: **Weight** (number, optional, kg/lb pill toggle defaulting to routine's `targetWeightUnit ?? 'kg'`) + **Reps** (number, defaulting to parseInt of `targetReps` if a clean integer, otherwise blank). Pre-fill with the previous set's actuals if any, falling back to target.
- **GIANT primary button** "Complete set" (or "Complete & finish" on last set) — at least `h-16`, full width, blue
- Collapsible "How to do it" details (closed by default to keep the screen clean during a workout)
- Bottom row: secondary "Skip exercise" link

When the user taps "Complete set":
1. If audio context not yet initialized, create it on this user gesture (`audioCtxRef.current = new (window.AudioContext || ...)()`). iOS Safari needs the AudioContext created during a user gesture to fire later beeps.
2. Update the session: set `sets[currentSetIdx] = { actualReps, actualWeight, weightUnit, completedAt: Date.now() }`
3. If more sets remain for this exercise → enter rest: `setRestEndsAt(Date.now() + restSeconds * 1000); setPhase('rest')` (skip rest entirely if `restSeconds === 0`)
4. Else if more exercises remain → advance to next exercise (no rest between exercises by default — rest is per-set)
5. Else → `setPhase('done'); session.completedAt = Date.now(); persist`

#### `phase === 'rest'` (RestStep inline)

- Big circular SVG ring countdown filling from full → empty as `(restEndsAt - now) / totalRestMs` shrinks (same pattern as Pomodoro's `<ProgressRing>` — but inline here; no need to extract)
- Center text: `MM:SS` remaining
- Sub-text: "Next: {next exercise name OR 'Set N of M'}"
- Primary button: "Skip rest" — sets `restEndsAt = Date.now()` (timer immediately fires the end transition)
- Tick: `setInterval(() => setNow(Date.now()), 250)` while `phase === 'rest'`; cleared on phase change/unmount

When `now >= restEndsAt`:
1. Cue: `playBeep(audioCtxRef.current)` + `navigator.vibrate?.(200)` + trigger flash class on container for 600ms
2. Advance: `setRestEndsAt(null); setPhase('exercise')` (the derived `currentExerciseIdx`/`currentSetIdx` already point at the next set)

```ts
function playBeep(ctx: AudioContext | null) {
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain).connect(ctx.destination)
    osc.frequency.value = 800
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch {
    // ignore — audio is a courtesy, not a feature requirement
  }
}
```

#### `phase === 'done'` (DoneScreen inline)

- Big checkmark + "Workout complete!" headline
- Stats grid (4 cards): Duration (`completedAt - startedAt` formatted MM:SS or HH:MM), Sets completed (`X / Y`), Total volume (`Σ actualWeight × actualReps` in kg — convert lb to kg for the sum), Exercises completed (`Z / N`)
- Primary "Save & exit" → calls `onFinish(session)` (orchestrator pushes to history + clears active)

#### Skip exercise

- Confirm inline ("Skip {name}?") → mark `session.exercises[idx].skipped = true`, advance currentExerciseIdx to next; persist

#### End workout

- Confirm inline ("End workout? Progress so far will be saved.") → set `session.completedAt = Date.now(); onFinish(session)` (saves partial session to history)
- "Cancel without saving" link → `onAbandon()` (discards the session entirely; no history entry)

### 4. Wake Lock + tab visibility

Inside WorkoutPlayer:

```ts
useEffect(() => {
  let lock: WakeLockSentinel | null = null
  let cancelled = false

  async function acquire() {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }
    if (!nav.wakeLock) return
    try {
      lock = await nav.wakeLock.request('screen')
    } catch {
      // user blocked, low-power mode, etc. — non-fatal
    }
  }

  acquire()

  function onVisibility() {
    if (document.visibilityState === 'visible' && !cancelled) acquire()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    cancelled = true
    document.removeEventListener('visibilitychange', onVisibility)
    lock?.release().catch(() => undefined)
  }
}, [])
```

(`WakeLockSentinel` is in the lib.dom.d.ts; if your TS lib doesn't expose it, type as `unknown` and narrow.)

### 5. Persistence + resume

The session is persisted via `useLocalStorage` at the orchestrator. The Player just calls `setSession` with the updated object on every state-changing user action. On reload mid-workout:

1. `useLocalStorage` re-hydrates `activeSession` from storage on mount
2. Orchestrator's branch evaluates → mounts WorkoutPlayer with the persisted session
3. WorkoutPlayer's `deriveInitialPhase(session)` finds the first incomplete set and returns `'exercise'` (no in-flight rest survives refresh — that's fine; user clicks Complete again or just starts the next set)

Edge case: if the user reloads DURING rest, we don't try to restore the rest timer (`restEndsAt` is transient). They land back on the exercise step at the same set; good enough.

### 6. Visual flash on rest-end

Add a CSS animation in `src/frontend/apps/workout/WorkoutPlayer.tsx` via Tailwind's existing `transition` utilities. Simplest: a momentary opacity overlay div triggered by a state flag:

```tsx
const [flashing, setFlashing] = useState(false)

// inside rest-end transition
setFlashing(true)
setTimeout(() => setFlashing(false), 600)

// JSX
{flashing && (
  <div className="fixed inset-0 z-[60] pointer-events-none bg-green-400/60 animate-pulse" aria-hidden="true" />
)}
```

(`animate-pulse` is a Tailwind default class — opacity pulse over 2s. With `setTimeout 600ms` we cut it short.)

### 7. Update RoutineList to surface `onStart` already wired

Phase 2 already gates the Start button on `onStart` being defined. With Phase 3 the orchestrator passes `onStart={handleStart}` so the Start button now appears.

## Acceptance criteria

- [ ] Tap **Start** on a routine → WorkoutPlayer takes over the screen (top app header still visible per project pattern)
- [ ] **Set 1** displays: image, name, target, reps + weight inputs pre-filled with target
- [ ] Tap **Complete set** → if `restSeconds > 0`, rest screen with countdown; else jumps to set 2 immediately
- [ ] During rest, the ring shrinks; "Skip rest" jumps to set 2 immediately
- [ ] When rest ends naturally: short audio beep (≤ 200ms) + vibration (Android only; iOS PWA silently no-ops or pulses if supported) + screen flash for 600ms + auto-advance to next set
- [ ] After last set of exercise → next exercise (no rest between exercises)
- [ ] After last set of last exercise → DoneScreen with stats; **Save & exit** archives to `snappet:workout:history` and clears `active-session`
- [ ] **Skip exercise** marks `skipped: true`, advances to next exercise; saved set logs preserved
- [ ] **End workout** with confirmation: saves partial session with `completedAt` set; available in history
- [ ] **Cancel without saving** (linked from End-workout confirm): clears active-session, no history entry
- [ ] Refresh page mid-workout → returns to the same exercise + same pending set (rest timer doesn't resume — acceptable; user re-completes the current set)
- [ ] Wake Lock acquired on Player mount (visible in DevTools → Application → Wake Lock); released on exit; re-acquired when tab becomes visible again
- [ ] Audio beep works after the first "Complete set" tap (the user gesture initializes the AudioContext)
- [ ] Existing Browse + Routines tabs work unchanged when no `activeSession`
- [ ] Mobile (375 px): one-thumb usable; "Complete set" reaches >= 60% of the lower screen
- [ ] Dark mode on all new UI
- [ ] `tsc --noEmit` clean; `npm run build` succeeds; precache shouldn't grow more than ~10 KiB

## Constraints

- **Drift-free timing** — never decrement a stored counter. Remaining = `restEndsAt - Date.now()` per render. Tick interval only forces re-renders (clear on phase change).
- **AudioContext init on user gesture only.** First "Complete set" tap creates it; reuse for subsequent beeps. iOS Safari rejects audio context created outside a gesture.
- **All Wake Lock / Audio / Vibration calls wrapped in `try/catch` or optional-chained** — they're nice-to-have. The session should run end-to-end even with all three disabled.
- **No new dependencies.**
- TypeScript strict; no `any`. `WakeLockSentinel` typing via lib.dom.d.ts or a local narrowing.
- Dark mode + focus-visible rings on all new UI.
- Tap targets ≥ 44 × 44 px in the Player (this is THE phone-at-the-gym workflow).

## Test plan

1. `npm run dev` → `/workout` → Routines tab → tap Start on "Beginner Full Body"
2. Player opens; Set 1 of 3 for Bodyweight Squat
3. Enter 12 reps → Complete set → rest starts at 60s
4. Wait for rest to end → beep (Mac/Android) → screen flash → Set 2 of 3
5. Skip rest manually → instant advance
6. Skip exercise → confirm → next exercise (Pushups)
7. End workout → confirm Save → DoneScreen with stats
8. Save & exit → routine list visible again; history now has 1 entry (persisted under `snappet:workout:history`)
9. Start another routine → during exercise step, refresh the page → resumes at the same exercise/set
10. End workout → Cancel without saving → active-session cleared, no history entry added
11. iPhone PWA: install if not already, repeat 1–8 in standalone mode; verify Wake Lock keeps the screen on for the rest period

## Notes for Phase 4

Phase 4 (history view) consumes `snappet:workout:history` — a chronological list of completed `WorkoutSession` objects. It does NOT need to write to active-session or session schema. Keep the WorkoutSession shape stable.
