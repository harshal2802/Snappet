import { formatWeightNumber, kgToUnit } from '../progress'
import { weeklyVolumeSeries } from './data'
import type { WeightUnit, WorkoutSession } from '../types'

interface VolumeSparklineProps {
  history: WorkoutSession[]
  now: number
  preferredUnit: WeightUnit
}

const WEEKS = 12
const WIDTH = 360
const HEIGHT = 110
const PAD_L = 6
const PAD_R = 6
const PAD_T = 18
const PAD_B = 18

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short' })
}

export default function VolumeSparkline({ history, now, preferredUnit }: VolumeSparklineProps) {
  const buckets = weeklyVolumeSeries(history, WEEKS, now)
  const max = buckets.reduce((m, b) => Math.max(m, b.volumeKg), 0)
  const safeMax = max > 0 ? max : 1
  const chartW = WIDTH - PAD_L - PAD_R
  const chartH = HEIGHT - PAD_T - PAD_B
  const stepX = buckets.length > 1 ? chartW / (buckets.length - 1) : chartW
  const points = buckets.map((b, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + chartH - (b.volumeKg / safeMax) * chartH,
    bucket: b,
  }))
  const nonZero = points.filter((p) => p.bucket.volumeKg > 0)
  const polyline = nonZero.map((p) => `${p.x},${p.y}`).join(' ')
  const current = points[points.length - 1]
  const currentLabel = `${formatWeightNumber(current.bucket.volumeKg, preferredUnit)} ${preferredUnit}`
  const maxInPreferredUnit = Math.round(kgToUnit(max, preferredUnit))

  // Month tick labels: first / middle / last bucket
  const tickIdxs = buckets.length >= 3 ? [0, Math.floor(buckets.length / 2), buckets.length - 1] : [0, buckets.length - 1]

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Volume ({preferredUnit}) · last 12 weeks
      </h3>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
        {max === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No tracked volume in the last 12 weeks.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Weekly volume sparkline, peak ${maxInPreferredUnit.toLocaleString()} ${preferredUnit}`}
          >
            {/* Polyline through non-zero weeks */}
            {nonZero.length >= 2 && (
              <polyline
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyline}
                className="stroke-blue-500 dark:stroke-blue-400"
              />
            )}
            {/* Dot on current week */}
            <circle
              cx={current.x}
              cy={current.y}
              r={4}
              className={
                current.bucket.volumeKg > 0
                  ? 'fill-blue-600 dark:fill-blue-400'
                  : 'fill-gray-300 dark:fill-gray-600'
              }
            />
            {/* Value annotation on current week */}
            <text
              x={current.x}
              y={Math.max(PAD_T - 4, current.y - 8)}
              textAnchor="end"
              className="fill-gray-700 dark:fill-gray-200"
              style={{ fontSize: '10px', fontWeight: 600 }}
            >
              {currentLabel}
            </text>
            {/* Per-bucket faint dots so the empty weeks still show */}
            {points.map((p, i) => (
              <g key={i}>
                <title>
                  {new Date(p.bucket.weekStart).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  : {formatWeightNumber(p.bucket.volumeKg, preferredUnit)} {preferredUnit}
                  {' · '}
                  {p.bucket.sessionCount} session{p.bucket.sessionCount === 1 ? '' : 's'}
                </title>
                {p.bucket.volumeKg > 0 && i !== points.length - 1 && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={2}
                    className="fill-blue-400 dark:fill-blue-500"
                  />
                )}
              </g>
            ))}
            {/* Bottom axis */}
            <line
              x1={PAD_L}
              x2={WIDTH - PAD_R}
              y1={HEIGHT - PAD_B + 2}
              y2={HEIGHT - PAD_B + 2}
              className="stroke-gray-200 dark:stroke-gray-700"
              strokeWidth={1}
            />
            {/* Month ticks */}
            {tickIdxs.map((i) => {
              const p = points[i]
              const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
              return (
                <text
                  key={i}
                  x={p.x}
                  y={HEIGHT - 4}
                  textAnchor={anchor}
                  className="fill-gray-400 dark:fill-gray-500"
                  style={{ fontSize: '9px' }}
                >
                  {monthLabel(p.bucket.weekStart)}
                </text>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
