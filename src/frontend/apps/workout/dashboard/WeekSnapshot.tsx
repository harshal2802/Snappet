import {
  currentStreakDays,
  lastWeekRange,
  sessionVolumeKg,
  sessionsInRange,
  thisWeekRange,
} from './data'
import type { WorkoutSession } from '../types'

interface WeekSnapshotProps {
  history: WorkoutSession[]
  now: number
}

function formatDelta(delta: number, unit?: string): { arrow: string; label: string; cls: string } {
  if (delta === 0) return { arrow: '·', label: 'same as last week', cls: 'text-gray-400 dark:text-gray-500' }
  if (delta > 0) {
    return {
      arrow: '↑',
      label: `+${delta.toLocaleString()}${unit ? ' ' + unit : ''} vs last week`,
      cls: 'text-green-600 dark:text-green-400',
    }
  }
  return {
    arrow: '↓',
    label: `${delta.toLocaleString()}${unit ? ' ' + unit : ''} vs last week`,
    cls: 'text-amber-600 dark:text-amber-400',
  }
}

interface TileProps {
  label: string
  value: string
  delta?: { arrow: string; label: string; cls: string }
  highlight?: boolean
}

function Tile({ label, value, delta, highlight }: TileProps) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 flex flex-col gap-0.5 ${
        highlight
          ? 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
        {value}
      </span>
      {delta && (
        <span className={`text-[11px] ${delta.cls}`}>
          {delta.arrow} {delta.label}
        </span>
      )}
    </div>
  )
}

export default function WeekSnapshot({ history, now }: WeekSnapshotProps) {
  const thisWeek = thisWeekRange(now)
  const lastWeek = lastWeekRange(now)
  const thisWeekSessions = sessionsInRange(history, thisWeek.fromMs, thisWeek.toMs)
  const lastWeekSessions = sessionsInRange(history, lastWeek.fromMs, lastWeek.toMs)

  const thisCount = thisWeekSessions.length
  const lastCount = lastWeekSessions.length
  const thisVolume = Math.round(thisWeekSessions.reduce((sum, s) => sum + sessionVolumeKg(s), 0))
  const lastVolume = Math.round(lastWeekSessions.reduce((sum, s) => sum + sessionVolumeKg(s), 0))
  const streak = currentStreakDays(history, now)

  const countDelta = lastCount === 0 ? undefined : formatDelta(thisCount - lastCount)
  const volumeDelta = lastVolume === 0 ? undefined : formatDelta(thisVolume - lastVolume, 'kg')

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        This week
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Sessions" value={thisCount.toString()} delta={countDelta} />
        <Tile label="Volume" value={`${thisVolume.toLocaleString()} kg`} delta={volumeDelta} />
        <Tile
          label="Streak"
          value={streak > 0 ? `🔥 ${streak}` : '—'}
          delta={
            streak > 0
              ? { arrow: '', label: streak === 1 ? '1 day' : `${streak} days in a row`, cls: 'text-gray-500 dark:text-gray-400' }
              : { arrow: '', label: 'no active streak', cls: 'text-gray-400 dark:text-gray-500' }
          }
          highlight={streak >= 3}
        />
      </div>
    </div>
  )
}
