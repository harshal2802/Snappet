import { dayCounts, isoDayKey, startOfWeek } from './data'
import type { WorkoutSession } from '../types'

interface ConsistencyHeatmapProps {
  history: WorkoutSession[]
  now: number
}

const WEEKS = 12
const DAYS = 7
const CELL = 14
const GAP = 3
const ROW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const ROW_LABEL_W = 16
const MONTH_LABEL_H = 14
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

function cellClass(count: number): string {
  if (count === 0) return 'fill-gray-100 dark:fill-gray-800'
  if (count === 1) return 'fill-blue-200 dark:fill-blue-900'
  if (count === 2) return 'fill-blue-400 dark:fill-blue-700'
  return 'fill-blue-600 dark:fill-blue-500'
}

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short' })
}

export default function ConsistencyHeatmap({ history, now }: ConsistencyHeatmapProps) {
  const currentWeekStart = startOfWeek(now)
  const firstWeekStart = currentWeekStart - (WEEKS - 1) * WEEK_MS
  const lastDay = currentWeekStart + DAYS * DAY_MS
  const counts = dayCounts(history, firstWeekStart, lastDay)

  // Compute month label positions — show a label at each column where the
  // month changes from the previous column's first day.
  const monthTicks: Array<{ x: number; label: string }> = []
  let lastSeen = ''
  for (let w = 0; w < WEEKS; w++) {
    const weekStartMs = firstWeekStart + w * WEEK_MS
    const label = monthLabel(weekStartMs)
    if (label !== lastSeen) {
      monthTicks.push({ x: ROW_LABEL_W + w * (CELL + GAP), label })
      lastSeen = label
    }
  }

  const width = ROW_LABEL_W + WEEKS * CELL + (WEEKS - 1) * GAP
  const gridH = DAYS * CELL + (DAYS - 1) * GAP
  const height = MONTH_LABEL_H + gridH + 12

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Last 12 weeks · consistency
        </h3>
        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span>Less</span>
          {[0, 1, 2, 3].map((n) => (
            <span
              key={n}
              className={`inline-block w-2.5 h-2.5 rounded-[2px] ${
                cellClass(n).replace('fill-', 'bg-')
              }`}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-w-md"
          role="img"
          aria-label="Workout consistency heatmap"
        >
          {/* Month labels */}
          {monthTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={10}
              textAnchor="start"
              className="fill-gray-500 dark:fill-gray-400"
              style={{ fontSize: '9px' }}
            >
              {t.label}
            </text>
          ))}
          {/* Day-of-week labels */}
          {ROW_LABELS.map((lbl, row) => (
            <text
              key={row}
              x={0}
              y={MONTH_LABEL_H + row * (CELL + GAP) + CELL - 3}
              textAnchor="start"
              className="fill-gray-400 dark:fill-gray-500"
              style={{ fontSize: '9px' }}
            >
              {row % 2 === 0 ? lbl : ''}
            </text>
          ))}
          {/* Cells */}
          {Array.from({ length: WEEKS }).map((_, w) =>
            Array.from({ length: DAYS }).map((_, d) => {
              const dayMs = firstWeekStart + w * WEEK_MS + d * DAY_MS
              const key = isoDayKey(dayMs)
              const count = counts.get(key) ?? 0
              const x = ROW_LABEL_W + w * (CELL + GAP)
              const y = MONTH_LABEL_H + d * (CELL + GAP)
              return (
                <g key={`${w}-${d}`}>
                  <title>
                    {new Date(dayMs).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {': '}
                    {count === 0 ? 'rest' : count === 1 ? '1 session' : `${count} sessions`}
                  </title>
                  <rect
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    className={cellClass(count)}
                  />
                </g>
              )
            }),
          )}
        </svg>
      </div>
    </div>
  )
}
