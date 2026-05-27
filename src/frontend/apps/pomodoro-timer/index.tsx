import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

type Phase = 'work' | 'short-break' | 'long-break'

interface TimerState {
  phase: Phase
  completedWorkSessions: number       // 0..3 — when it reaches 4, the next phase is long-break
  startedAt: number | null            // ms; non-null ⇢ running
  pausedRemainingMs: number | null    // ms; non-null ⇢ paused
}

const WORK_MS = 25 * 60 * 1000
const SHORT_BREAK_MS = 5 * 60 * 1000
const LONG_BREAK_MS = 15 * 60 * 1000
const SESSIONS_UNTIL_LONG = 4

function phaseDuration(phase: Phase): number {
  switch (phase) {
    case 'work':
      return WORK_MS
    case 'short-break':
      return SHORT_BREAK_MS
    case 'long-break':
      return LONG_BREAK_MS
  }
}

function nextPhase(current: Phase, completedWorkSessions: number): Phase {
  if (current === 'work') {
    return completedWorkSessions + 1 >= SESSIONS_UNTIL_LONG ? 'long-break' : 'short-break'
  }
  return 'work'
}

const PHASE_LABEL: Record<Phase, string> = {
  work: 'Work',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
}

// Static class strings so Tailwind keeps them.
const PHASE_DOT: Record<Phase, string> = {
  work: 'bg-red-500 dark:bg-red-400',
  'short-break': 'bg-green-500 dark:bg-green-400',
  'long-break': 'bg-blue-500 dark:bg-blue-400',
}

const PHASE_RING_STROKE: Record<Phase, string> = {
  work: 'stroke-red-500 dark:stroke-red-400',
  'short-break': 'stroke-green-500 dark:stroke-green-400',
  'long-break': 'stroke-blue-500 dark:stroke-blue-400',
}

const INITIAL_STATE: TimerState = {
  phase: 'work',
  completedWorkSessions: 0,
  startedAt: null,
  pausedRemainingMs: phaseDuration('work'),
}

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface ProgressRingProps {
  remainingMs: number
  totalMs: number
  phase: Phase
}

const RING_SIZE = 240
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRC = 2 * Math.PI * RING_RADIUS

function ProgressRing({ remainingMs, totalMs, phase }: ProgressRingProps) {
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs))
  const dashOffset = RING_CIRC * (1 - fraction)
  return (
    <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={dashOffset}
          className={`${PHASE_RING_STROKE[phase]} transition-[stroke-dashoffset] duration-300`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-mono font-bold text-gray-900 dark:text-gray-100 tabular-nums">
          {formatMmSs(remainingMs)}
        </span>
        <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-2">
          {PHASE_LABEL[phase]}
        </span>
      </div>
    </div>
  )
}

export default function PomodoroTimer() {
  const [state, setState] = useLocalStorage<TimerState>(
    'snappet:pomodoro:state',
    INITIAL_STATE,
  )
  const [now, setNow] = useState<number>(() => Date.now())
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const [fallbackBanner, setFallbackBanner] = useState<string | null>(null)
  // Ref to detect "phase ended while away" on first render after refresh, so we
  // don't fire a notification on every state update.
  const sawTickedOutRef = useRef(false)

  const isRunning = state.startedAt !== null

  const totalMs = phaseDuration(state.phase)
  const remainingMs = isRunning
    ? Math.max(0, totalMs - (now - (state.startedAt ?? now)))
    : state.pausedRemainingMs ?? totalMs

  // Tick — re-render every 250ms while running so the display stays smooth and
  // we can detect rollover.
  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [isRunning])

  // Phase rollover — when remaining hits zero, advance and pause in the new
  // phase so the user starts it deliberately.
  useEffect(() => {
    if (!isRunning) return
    if (remainingMs > 0) {
      sawTickedOutRef.current = false
      return
    }
    if (sawTickedOutRef.current) return
    sawTickedOutRef.current = true
    advancePhase()
  }, [isRunning, remainingMs])

  function fireNotification(prevPhase: Phase, newPhase: Phase) {
    const title =
      prevPhase === 'work'
        ? 'Work session complete'
        : 'Break complete — back to work'
    const body = `Up next: ${PHASE_LABEL[newPhase]}`
    if (typeof Notification === 'undefined' || notifPermission !== 'granted') {
      setFallbackBanner(`${title}. ${body}.`)
      window.setTimeout(() => setFallbackBanner(null), 4000)
      return
    }
    try {
      new Notification(title, { body })
    } catch {
      setFallbackBanner(`${title}. ${body}.`)
      window.setTimeout(() => setFallbackBanner(null), 4000)
    }
  }

  function advancePhase() {
    setState((prev) => {
      const completed = prev.phase === 'work'
        ? Math.min(prev.completedWorkSessions + 1, SESSIONS_UNTIL_LONG)
        : prev.completedWorkSessions
      const upcoming = nextPhase(prev.phase, prev.completedWorkSessions)
      // After a long break, reset the work-session counter
      const resetCounter = prev.phase === 'long-break'
      fireNotification(prev.phase, upcoming)
      return {
        phase: upcoming,
        completedWorkSessions: resetCounter ? 0 : completed,
        startedAt: null,
        pausedRemainingMs: phaseDuration(upcoming),
      }
    })
  }

  async function handleStart() {
    if (
      typeof Notification !== 'undefined' &&
      notifPermission === 'default'
    ) {
      try {
        const result = await Notification.requestPermission()
        setNotifPermission(result)
      } catch {
        // ignore — fall back to in-app banner
      }
    }
    setState((prev) => {
      const remaining = prev.pausedRemainingMs ?? phaseDuration(prev.phase)
      return {
        ...prev,
        startedAt: Date.now() - (phaseDuration(prev.phase) - remaining),
        pausedRemainingMs: null,
      }
    })
  }

  function handlePause() {
    setState((prev) => {
      if (prev.startedAt === null) return prev
      const remaining = Math.max(
        0,
        phaseDuration(prev.phase) - (Date.now() - prev.startedAt),
      )
      return {
        ...prev,
        startedAt: null,
        pausedRemainingMs: remaining,
      }
    })
  }

  function handleSkip() {
    // Treat as if the current phase ended — advance and reset.
    advancePhase()
  }

  function handleReset() {
    setState(INITIAL_STATE)
    sawTickedOutRef.current = false
  }

  const sessionPipFilled = (i: number) => i < state.completedWorkSessions

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Pomodoro Timer
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            25-min focus blocks with short and long breaks.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ↺ Reset
        </button>
      </div>

      {/* Phase label */}
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${PHASE_DOT[state.phase]}`} />
        {PHASE_LABEL[state.phase]}
      </div>

      {/* Progress ring */}
      <div className="flex items-center justify-center">
        <ProgressRing remainingMs={remainingMs} totalMs={totalMs} phase={state.phase} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {isRunning ? (
          <button
            onClick={handlePause}
            className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="px-5 py-2.5 rounded-xl bg-blue-600 dark:bg-blue-500 text-white text-sm font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ▶ Start
          </button>
        )}
        <button
          onClick={handleSkip}
          className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Skip
        </button>
      </div>

      {/* Session pips */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: SESSIONS_UNTIL_LONG }).map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                sessionPipFilled(i)
                  ? 'bg-red-500 dark:bg-red-400'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Session {Math.min(state.completedWorkSessions + (state.phase === 'work' ? 1 : 0), SESSIONS_UNTIL_LONG)} of {SESSIONS_UNTIL_LONG}
        </p>
      </div>

      {/* Permission hint */}
      {typeof Notification !== 'undefined' && notifPermission === 'default' && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center space-y-1">
          <p>Allow notifications to be alerted when a phase ends.</p>
          <p className="text-[10px]">
            On iPhone, install Snappet to your home screen first — Safari's tab can't request notifications.
          </p>
        </div>
      )}

      {/* Fallback banner if notifications denied */}
      {fallbackBanner && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-300 text-center">
          {fallbackBanner}
        </div>
      )}
    </div>
  )
}
