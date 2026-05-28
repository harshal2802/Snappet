import type { WorkoutSession } from './types'

interface ExerciseProgressProps {
  exerciseId: string
  history: WorkoutSession[]
  /** Cap on most-recent sessions to chart. Default 10. */
  limit?: number
  /** When set, render a ★ above the bar whose session matches this timestamp. */
  prSessionStartedAt?: number
}

interface DataPoint {
  date: number      // session startedAt
  topSet: number    // weight × reps of best set; weight defaulted to 1 for bodyweight
}

// Compute top-set "volume" for one exercise in one session. Bodyweight
// (no weight tracked) treats weight as 1 so reps alone produce a value;
// pure SVG chart below normalizes by max so the bar heights stay readable.
function topSetVolume(session: WorkoutSession, exerciseId: string): number | null {
  const ex = session.exercises.find((e) => e.exerciseId === exerciseId)
  if (!ex) return null
  let best = 0
  for (const s of ex.sets) {
    if (!s.completedAt) continue
    const reps = s.actualReps ?? 0
    const weight = s.actualWeight ?? 1
    const v = weight * reps
    if (v > best) best = v
  }
  return best > 0 ? best : null
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ExerciseProgress({
  exerciseId,
  history,
  limit = 10,
  prSessionStartedAt,
}: ExerciseProgressProps) {
  // Filter + map. `history` is most-recent-first; collect up to `limit` and
  // reverse for chronological left-to-right.
  const points: DataPoint[] = []
  for (const session of history) {
    if (points.length >= limit) break
    const top = topSetVolume(session, exerciseId)
    if (top !== null) points.push({ date: session.startedAt, topSet: top })
  }
  points.reverse()

  if (points.length < 2) return null

  // Layout
  const WIDTH = 320
  const HEIGHT = 120
  const PAD_L = 4
  const PAD_R = 4
  const PAD_T = 12
  const PAD_B = 18 // axis labels
  const chartW = WIDTH - PAD_L - PAD_R
  const chartH = HEIGHT - PAD_T - PAD_B

  const max = points.reduce((m, p) => Math.max(m, p.topSet), 0)
  const safeMax = max > 0 ? max : 1

  const slotW = chartW / points.length
  const barW = Math.max(4, Math.min(28, slotW * 0.65))

  // Axis tick indices: first, middle, last (when ≥ 3 points; else first + last)
  const tickIdx =
    points.length >= 3
      ? [0, Math.floor(points.length / 2), points.length - 1]
      : [0, points.length - 1]

  return (
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        Progress · top set per session
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Top-set progress over last ${points.length} sessions`}
      >
        {points.map((p, i) => {
          const h = Math.max(2, (p.topSet / safeMax) * chartH)
          const x = PAD_L + i * slotW + (slotW - barW) / 2
          const y = PAD_T + (chartH - h)
          const isPR =
            prSessionStartedAt !== undefined && p.date === prSessionStartedAt
          return (
            <g key={i}>
              <title>
                {formatShortDate(p.date)}: {Math.round(p.topSet)}
                {isPR ? ' · PR' : ''}
              </title>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                className={isPR ? 'fill-amber-500 dark:fill-amber-400' : 'fill-blue-500 dark:fill-blue-400'}
              />
              {isPR && (
                <text
                  x={x + barW / 2}
                  y={Math.max(PAD_T - 2, y - 4)}
                  textAnchor="middle"
                  className="fill-amber-500 dark:fill-amber-400"
                  style={{ fontSize: '10px' }}
                >
                  ★
                </text>
              )}
            </g>
          )
        })}
        {/* Axis */}
        <line
          x1={PAD_L}
          x2={WIDTH - PAD_R}
          y1={HEIGHT - PAD_B + 2}
          y2={HEIGHT - PAD_B + 2}
          className="stroke-gray-200 dark:stroke-gray-700"
          strokeWidth={1}
        />
        {/* Tick labels */}
        {tickIdx.map((i) => {
          const x = PAD_L + i * slotW + slotW / 2
          const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
          const tx = i === 0 ? PAD_L : i === points.length - 1 ? WIDTH - PAD_R : x
          return (
            <text
              key={i}
              x={tx}
              y={HEIGHT - 4}
              textAnchor={anchor}
              className="fill-gray-400 dark:fill-gray-500 text-[9px]"
              style={{ fontSize: '9px' }}
            >
              {formatShortDate(points[i].date)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
