import { useEffect, useMemo, useRef, useState } from 'react'
import ExerciseImage from './ExerciseImage'
import { getDisplayName } from './utils'
import type {
  Exercise,
  SessionExercise,
  SetLog,
  WeightUnit,
  WorkoutSession,
} from './types'

interface WorkoutPlayerProps {
  session: WorkoutSession
  setSession: React.Dispatch<React.SetStateAction<WorkoutSession | null>>
  exerciseById: Map<string, Exercise>
  preferredUnit: WeightUnit
  setPreferredUnit: (u: WeightUnit) => void
  onFinish: (final: WorkoutSession) => void
  onAbandon: () => void
}

type Phase = 'exercise' | 'rest' | 'done'

// ── Helpers ─────────────────────────────────────────────────────────────────

function isExerciseDone(ex: SessionExercise): boolean {
  if (ex.skipped) return true
  return ex.sets.every((s) => s.completedAt !== undefined)
}

function firstPendingSetIdx(ex: SessionExercise): number {
  const i = ex.sets.findIndex((s) => s.completedAt === undefined)
  return i === -1 ? ex.sets.length - 1 : i
}

function firstPendingExerciseIdx(session: WorkoutSession): number {
  const i = session.exercises.findIndex((ex) => !isExerciseDone(ex))
  return i === -1 ? session.exercises.length - 1 : i
}

function isSessionDone(session: WorkoutSession): boolean {
  return session.exercises.every(isExerciseDone)
}

function deriveInitialPhase(session: WorkoutSession): Phase {
  return isSessionDone(session) ? 'done' : 'exercise'
}

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function toKg(weight: number, unit: WeightUnit | undefined): number {
  return unit === 'lb' ? weight * 0.453592 : weight
}

function totalVolumeKg(session: WorkoutSession): number {
  let total = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.completedAt && s.actualReps && s.actualWeight) {
        total += toKg(s.actualWeight, s.weightUnit) * s.actualReps
      }
    }
  }
  return Math.round(total)
}

function setsCompleted(session: WorkoutSession): { done: number; target: number } {
  let done = 0
  let target = 0
  for (const ex of session.exercises) {
    target += ex.targetSets
    for (const s of ex.sets) {
      if (s.completedAt) done += 1
    }
  }
  return { done, target }
}

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
    // audio is a courtesy, not a requirement
  }
}

// Minimal WakeLockSentinel type — TS lib.dom.d.ts may or may not expose it
// depending on `lib` config. Narrow what we use.
interface WakeLockSentinelLike {
  release: () => Promise<void>
}
interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WorkoutPlayer({
  session,
  setSession,
  exerciseById,
  preferredUnit,
  setPreferredUnit,
  onFinish,
  onAbandon,
}: WorkoutPlayerProps) {
  const [phase, setPhase] = useState<Phase>(() => deriveInitialPhase(session))
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const restTotalRef = useRef<number>(0) // total rest duration in ms for ring math
  const [now, setNow] = useState(() => Date.now())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  // Inputs for the current set — local string state so user can clear / partial-type.
  const [weightInput, setWeightInput] = useState<string>('')
  const [repsInput, setRepsInput] = useState<string>('')
  const [unitInput, setUnitInput] = useState<WeightUnit>('kg')

  // Derived: current exercise + set
  const currentExerciseIdx = useMemo(() => firstPendingExerciseIdx(session), [session])
  const currentExercise = session.exercises[currentExerciseIdx]
  const currentSetIdx = useMemo(
    () => (currentExercise ? firstPendingSetIdx(currentExercise) : 0),
    [currentExercise],
  )
  const ex = currentExercise ? exerciseById.get(currentExercise.exerciseId) : undefined

  // Pre-fill inputs when current set changes
  useEffect(() => {
    if (!currentExercise) return
    const prev = currentSetIdx > 0 ? currentExercise.sets[currentSetIdx - 1] : null
    if (prev?.completedAt) {
      setWeightInput(prev.actualWeight !== undefined ? String(prev.actualWeight) : '')
      setRepsInput(prev.actualReps !== undefined ? String(prev.actualReps) : '')
      setUnitInput(prev.weightUnit ?? currentExercise.targetWeightUnit ?? preferredUnit)
    } else {
      // Fall back to targets
      setWeightInput(
        currentExercise.targetWeight !== undefined ? String(currentExercise.targetWeight) : '',
      )
      const targetRepInt = parseInt(currentExercise.targetReps, 10)
      setRepsInput(Number.isFinite(targetRepInt) ? String(targetRepInt) : '')
      setUnitInput(currentExercise.targetWeightUnit ?? preferredUnit)
    }
  }, [currentExerciseIdx, currentSetIdx, currentExercise, preferredUnit])

  // Tick during rest
  useEffect(() => {
    if (phase !== 'rest') return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [phase])

  // Auto-advance when rest ends
  useEffect(() => {
    if (phase !== 'rest' || restEndsAt === null) return
    if (now < restEndsAt) return
    // Rest finished — cue and advance
    playBeep(audioCtxRef.current)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(200)
    }
    setFlashing(true)
    window.setTimeout(() => setFlashing(false), 600)
    setRestEndsAt(null)
    // If session done after this set's completion (rest only fires between sets)
    setPhase(isSessionDone(session) ? 'done' : 'exercise')
  }, [now, phase, restEndsAt, session])

  // Wake Lock — acquire on mount, re-acquire when tab returns to foreground.
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null
    let cancelled = false
    const nav = navigator as Navigator & NavigatorWithWakeLock

    async function acquire() {
      if (!nav.wakeLock) return
      try {
        const newLock = await nav.wakeLock.request('screen')
        // Guard against the unmount-during-await race: if cleanup already
        // ran while we were awaiting, release immediately instead of leaking.
        if (cancelled) {
          newLock.release().catch(() => undefined)
          return
        }
        lock = newLock
      } catch {
        // user blocked, low-power mode, etc.
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  function ensureAudio() {
    if (!audioCtxRef.current) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Ctor) audioCtxRef.current = new Ctor()
      } catch {
        // ignore
      }
    }
    // iOS Safari starts the context in 'suspended' state; resume() must be
    // called from a user gesture so subsequent programmatic plays (the
    // rest-end beep) actually emit audio.
    const ctx = audioCtxRef.current
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined)
    }
  }

  function persistSession(updater: (s: WorkoutSession) => WorkoutSession) {
    setSession((prev) => (prev ? updater(prev) : prev))
  }

  function handleCompleteSet() {
    if (!currentExercise) return
    ensureAudio()
    const reps = repsInput.trim() === '' ? undefined : Math.max(0, Number(repsInput))
    const weight = weightInput.trim() === '' ? undefined : Math.max(0, Number(weightInput))
    const setLog: SetLog = {
      actualReps: Number.isFinite(reps) ? reps : undefined,
      actualWeight: Number.isFinite(weight) ? weight : undefined,
      weightUnit: weight !== undefined ? unitInput : undefined,
      completedAt: Date.now(),
    }

    persistSession((s) => {
      const exercises = s.exercises.map((e, i) =>
        i === currentExerciseIdx
          ? { ...e, sets: e.sets.map((slot, j) => (j === currentSetIdx ? setLog : slot)) }
          : e,
      )
      const next: WorkoutSession = { ...s, exercises }
      // Auto-complete on the last set
      if (isSessionDone(next) && !next.completedAt) {
        next.completedAt = Date.now()
      }
      return next
    })

    const moreSets = currentSetIdx < currentExercise.targetSets - 1
    const moreExercises = session.exercises.some((e, i) => i > currentExerciseIdx && !isExerciseDone(e))

    if (moreSets && currentExercise.targetRestSeconds > 0) {
      restTotalRef.current = currentExercise.targetRestSeconds * 1000
      setRestEndsAt(Date.now() + restTotalRef.current)
      setNow(Date.now())
      setPhase('rest')
      return
    }
    if (!moreSets && !moreExercises) {
      setPhase('done')
      return
    }
    // Either: more sets but no rest, OR moving to next exercise — stay on 'exercise'
    setPhase('exercise')
  }

  function handleSkipRest() {
    setRestEndsAt(Date.now())
    setNow(Date.now())
  }

  function handleSkipExercise() {
    if (!currentExercise) return
    persistSession((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i === currentExerciseIdx ? { ...e, skipped: true } : e)),
    }))
    setConfirmSkip(false)
    setRestEndsAt(null)
    // Re-derive next via the next render — currentExerciseIdx will advance
    if (session.exercises.every((e, i) => i === currentExerciseIdx || isExerciseDone(e))) {
      setPhase('done')
      persistSession((s) => ({ ...s, completedAt: s.completedAt ?? Date.now() }))
    } else {
      setPhase('exercise')
    }
  }

  function handleEndSave() {
    persistSession((s) => ({ ...s, completedAt: s.completedAt ?? Date.now() }))
    // Read the updated session via the setter chain — simplest is to grab from props
    // and patch the completedAt locally for the onFinish call.
    onFinish({ ...session, completedAt: session.completedAt ?? Date.now() })
  }

  function handleSaveExit() {
    onFinish({ ...session, completedAt: session.completedAt ?? Date.now() })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const sets = setsCompleted(session)
  const progressPct = sets.target === 0 ? 0 : Math.min(100, (sets.done / sets.target) * 100)
  const restRemaining = restEndsAt !== null ? Math.max(0, restEndsAt - now) : 0
  const restFraction = restTotalRef.current > 0 ? restRemaining / restTotalRef.current : 0

  // Ring math for rest countdown
  const RING_SIZE = 240
  const RING_STROKE = 14
  const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
  const RING_CIRC = 2 * Math.PI * RING_RADIUS
  const ringOffset = RING_CIRC * (1 - restFraction)

  return (
    <div className="fixed inset-0 top-[57px] flex flex-col bg-white dark:bg-gray-900">
      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-4 py-2 gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {session.routineName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Exercise {Math.min(currentExerciseIdx + 1, session.exercises.length)} of{' '}
              {session.exercises.length} · {sets.done}/{sets.target} sets
            </p>
          </div>
          <button
            onClick={() => setConfirmEnd((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            End
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {confirmEnd && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-red-700 dark:text-red-400">
              End workout? Progress saves to history.
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setConfirmEnd(false)}
                className="px-2 py-1 rounded text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setConfirmEnd(false)
                  onAbandon()
                }}
                className="px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Cancel (don't save)
              </button>
              <button
                onClick={handleEndSave}
                className="px-2 py-1 rounded text-xs bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Save & exit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {phase === 'done' && (
          <DoneScreen session={session} onSaveExit={handleSaveExit} />
        )}

        {phase !== 'done' && currentExercise && (
          <div className="max-w-md mx-auto p-4 space-y-4 pb-32">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 max-h-[40vh] flex items-center justify-center">
              {ex?.images[0] ? (
                <ExerciseImage
                  path={ex.images[0]}
                  alt={getDisplayName(currentExercise, ex)}
                  className="w-full h-full object-contain max-h-[40vh]"
                />
              ) : (
                <div className="aspect-[4/3] w-full" />
              )}
            </div>

            {/* Name + target */}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {getDisplayName(currentExercise, ex)}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentExercise.targetSets} × {currentExercise.targetReps}
                {currentExercise.targetWeight !== undefined && currentExercise.targetWeight > 0
                  ? ` @ ${currentExercise.targetWeight}${currentExercise.targetWeightUnit ?? 'kg'}`
                  : ''}
                {currentExercise.targetRestSeconds > 0
                  ? `, ${currentExercise.targetRestSeconds}s rest`
                  : ''}
              </p>
              {/* Set pips */}
              <div className="flex items-center gap-1.5 pt-1">
                {currentExercise.sets.map((s, i) => {
                  const done = s.completedAt !== undefined
                  const current = i === currentSetIdx
                  return (
                    <span
                      key={i}
                      aria-label={`Set ${i + 1} ${done ? 'done' : current ? 'current' : 'pending'}`}
                      className={`w-2.5 h-2.5 rounded-full ${
                        done
                          ? 'bg-blue-500 dark:bg-blue-400'
                          : current
                            ? 'border-2 border-blue-500 dark:border-blue-400'
                            : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )
                })}
              </div>
            </div>

            {phase === 'exercise' && (
              <ExerciseStep
                exerciseId={currentExercise.exerciseId}
                setIdx={currentSetIdx}
                totalSets={currentExercise.targetSets}
                weightInput={weightInput}
                setWeightInput={setWeightInput}
                repsInput={repsInput}
                setRepsInput={setRepsInput}
                unitInput={unitInput}
                setUnitInput={(u) => {
                  setUnitInput(u)
                  // User explicitly chose a unit mid-workout — persist so
                  // subsequent exercises (and future sessions) default to it.
                  setPreferredUnit(u)
                }}
                isLastSet={
                  currentSetIdx === currentExercise.targetSets - 1 &&
                  !session.exercises.some(
                    (e, i) => i > currentExerciseIdx && !isExerciseDone(e),
                  )
                }
                instructions={ex?.instructions ?? []}
                onComplete={handleCompleteSet}
                onSkipExercise={() => setConfirmSkip(true)}
                confirmSkip={confirmSkip}
                onCancelSkip={() => setConfirmSkip(false)}
                onConfirmSkip={handleSkipExercise}
              />
            )}

            {phase === 'rest' && (
              <RestStep
                ringSize={RING_SIZE}
                ringStroke={RING_STROKE}
                ringRadius={RING_RADIUS}
                ringCirc={RING_CIRC}
                ringOffset={ringOffset}
                remainingMs={restRemaining}
                onSkip={handleSkipRest}
                nextLabel={
                  currentSetIdx < currentExercise.targetSets - 1
                    ? `Set ${currentSetIdx + 1} of ${currentExercise.targetSets}`
                    : (() => {
                        const nextEx = session.exercises.find(
                          (e, i) => i > currentExerciseIdx && !isExerciseDone(e),
                        )
                        if (!nextEx) return 'finish'
                        return getDisplayName(nextEx, exerciseById.get(nextEx.exerciseId))
                      })()
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Rest-end flash */}
      {flashing && (
        <div
          className="fixed inset-0 z-[60] pointer-events-none bg-green-400/50 animate-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface ExerciseStepProps {
  exerciseId: string
  setIdx: number
  totalSets: number
  weightInput: string
  setWeightInput: (v: string) => void
  repsInput: string
  setRepsInput: (v: string) => void
  unitInput: WeightUnit
  setUnitInput: (u: WeightUnit) => void
  isLastSet: boolean
  instructions: string[]
  onComplete: () => void
  onSkipExercise: () => void
  confirmSkip: boolean
  onCancelSkip: () => void
  onConfirmSkip: () => void
}

function ExerciseStep({
  exerciseId,
  setIdx,
  totalSets,
  weightInput,
  setWeightInput,
  repsInput,
  setRepsInput,
  unitInput,
  setUnitInput,
  isLastSet,
  instructions,
  onComplete,
  onSkipExercise,
  confirmSkip,
  onCancelSkip,
  onConfirmSkip,
}: ExerciseStepProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  // Reset instructions toggle when exercise changes (via exerciseId)
  useEffect(() => {
    setInstructionsOpen(false)
  }, [exerciseId])

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        Set {setIdx + 1} of {totalSets}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Weight
          </label>
          <div className="flex">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="—"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-r-lg overflow-hidden">
              {(['kg', 'lb'] as WeightUnit[]).map((u) => {
                const active = unitInput === u
                return (
                  <button
                    key={u}
                    onClick={() => setUnitInput(u)}
                    aria-pressed={active}
                    className={`px-2 text-xs font-medium ${
                      active
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                  >
                    {u}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Reps
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={repsInput}
            onChange={(e) => setRepsInput(e.target.value)}
            placeholder="—"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <button
        onClick={onComplete}
        className="w-full h-16 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white text-base font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ✓ {isLastSet ? 'Complete & finish' : 'Complete set'}
      </button>

      {/* Skip exercise — confirm inline */}
      {confirmSkip ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-amber-700 dark:text-amber-400">Skip remaining sets?</span>
          <div className="flex gap-1.5">
            <button
              onClick={onCancelSkip}
              className="px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Keep going
            </button>
            <button
              onClick={onConfirmSkip}
              className="px-2 py-1 rounded bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onSkipExercise}
          className="block mx-auto text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 underline focus:outline-none focus-visible:no-underline"
        >
          Skip exercise
        </button>
      )}

      {/* Instructions */}
      {instructions.length > 0 && (
        <details
          open={instructionsOpen}
          onToggle={(e) => setInstructionsOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <summary className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
            How to do it
          </summary>
          <ol className="list-decimal list-outside ml-8 mr-3 mb-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

interface RestStepProps {
  ringSize: number
  ringStroke: number
  ringRadius: number
  ringCirc: number
  ringOffset: number
  remainingMs: number
  onSkip: () => void
  nextLabel: string
}

function RestStep({
  ringSize,
  ringStroke,
  ringRadius,
  ringCirc,
  ringOffset,
  remainingMs,
  onSkip,
  nextLabel,
}: RestStepProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        Rest
      </p>
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <svg
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          className="-rotate-90"
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringRadius}
            fill="none"
            strokeWidth={ringStroke}
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringRadius}
            fill="none"
            strokeWidth={ringStroke}
            strokeLinecap="round"
            strokeDasharray={ringCirc}
            strokeDashoffset={ringOffset}
            className="stroke-blue-500 dark:stroke-blue-400 transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-mono font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {formatMmSs(remainingMs)}
          </span>
          <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-2 text-center px-4">
            Next: {nextLabel}
          </span>
        </div>
      </div>
      <button
        onClick={onSkip}
        className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Skip rest
      </button>
    </div>
  )
}

interface DoneScreenProps {
  session: WorkoutSession
  onSaveExit: () => void
}

function DoneScreen({ session, onSaveExit }: DoneScreenProps) {
  const duration = (session.completedAt ?? Date.now()) - session.startedAt
  const sets = setsCompleted(session)
  const volume = totalVolumeKg(session)
  const exercisesDone = session.exercises.filter(isExerciseDone).length

  const STAT_CARD =
    'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-1'
  const STAT_LABEL = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'
  const STAT_VALUE = 'text-2xl font-bold text-gray-900 dark:text-gray-100'

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="text-center py-4">
        <span className="text-5xl">🎉</span>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
          Workout complete
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{session.routineName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Duration</span>
          <span className={STAT_VALUE}>{formatDuration(duration)}</span>
        </div>
        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Sets</span>
          <span className={STAT_VALUE}>
            {sets.done}
            <span className="text-base font-medium text-gray-400 dark:text-gray-500">
              {' '}/ {sets.target}
            </span>
          </span>
        </div>
        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Exercises</span>
          <span className={STAT_VALUE}>
            {exercisesDone}
            <span className="text-base font-medium text-gray-400 dark:text-gray-500">
              {' '}/ {session.exercises.length}
            </span>
          </span>
        </div>
        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Volume</span>
          <span className={STAT_VALUE}>
            {volume.toLocaleString()}
            <span className="text-base font-medium text-gray-400 dark:text-gray-500"> kg</span>
          </span>
        </div>
      </div>

      <button
        onClick={onSaveExit}
        className="w-full h-14 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white text-base font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Save & exit
      </button>
    </div>
  )
}
