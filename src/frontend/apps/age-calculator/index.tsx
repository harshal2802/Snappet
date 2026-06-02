import { useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'

interface AgeParts {
  years: number
  months: number
  days: number
}

const DAY_MS = 86_400_000
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

// Parse a YYYY-MM-DD input value into a local-time Date (avoids the UTC
// interpretation that `new Date("YYYY-MM-DD")` would give).
function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  // Reject invalid combinations like Feb 30
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null
  }
  return date
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function calcAge(birth: Date, now: Date): AgeParts {
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()

  if (days < 0) {
    // Borrow days from the previous month (in `now`'s calendar)
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    days += prevMonth.getDate()
    months -= 1
  }
  if (months < 0) {
    months += 12
    years -= 1
  }
  return { years, months, days }
}

function daysUntilNextBirthday(
  birth: Date,
  now: Date,
): { days: number; nextDate: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
  }
  const days = Math.round((next.getTime() - today.getTime()) / DAY_MS)
  return { days, nextDate: next }
}

function totalDaysLived(birth: Date, now: Date): number {
  const birthMidnight = new Date(
    birth.getFullYear(),
    birth.getMonth(),
    birth.getDate(),
  )
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((todayMidnight.getTime() - birthMidnight.getTime()) / DAY_MS)
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm'

const STAT_CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm flex flex-col gap-1'

const STAT_LABEL =
  'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'

const STAT_PRIMARY = 'text-3xl font-bold text-gray-900 dark:text-gray-100'

const STAT_SECONDARY = 'text-sm text-gray-500 dark:text-gray-400'

export default function AgeCalculator() {
  const [birthdate, setBirthdate] = useLocalStorage<string>(
    'snappet:age-calculator:birthdate',
    '',
  )

  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => formatIsoDate(today), [today])

  const parsed = useMemo(() => parseLocalDate(birthdate), [birthdate])
  const isFuture = parsed !== null && parsed.getTime() > today.getTime()
  const validBirth = parsed && !isFuture ? parsed : null

  const stats = useMemo(() => {
    if (!validBirth) return null
    const age = calcAge(validBirth, today)
    const { days: untilNext, nextDate } = daysUntilNextBirthday(validBirth, today)
    return {
      age,
      untilNext,
      nextDate,
      bornOn: DAY_NAMES[validBirth.getDay()],
      totalDays: totalDaysLived(validBirth, today),
    }
  }, [validBirth, today])

  function handleReset() {
    setBirthdate('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Age Calculator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pick your birthdate to see your exact age, next birthday, and more.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="age-calculator" steps={tourSteps} />
          <button
            onClick={handleReset}
            data-tour="reset"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Date input */}
      <div className={CARD} data-tour="birthdate">
        <label
          htmlFor="age-calc-birthdate"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Your birthdate
        </label>
        <input
          id="age-calc-birthdate"
          type="date"
          value={birthdate}
          max={todayIso}
          onChange={(e) => setBirthdate(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        {validBirth && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Selected: {formatLongDate(validBirth)}
          </p>
        )}
        {isFuture && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Birthdate can't be in the future.
          </p>
        )}
      </div>

      {/* Stats */}
      <div data-tour="results">
      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={STAT_CARD}>
            <span className={STAT_LABEL}>Age</span>
            <span className={STAT_PRIMARY}>
              {stats.age.years} <span className="text-base font-medium text-gray-500 dark:text-gray-400">years</span>
            </span>
            <span className={STAT_SECONDARY}>
              {stats.age.months} {stats.age.months === 1 ? 'month' : 'months'},{' '}
              {stats.age.days} {stats.age.days === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className={STAT_CARD}>
            <span className={STAT_LABEL}>Next birthday</span>
            {stats.untilNext === 0 ? (
              <>
                <span className={STAT_PRIMARY}>Today! 🎉</span>
                <span className={STAT_SECONDARY}>Happy birthday.</span>
              </>
            ) : (
              <>
                <span className={STAT_PRIMARY}>
                  {stats.untilNext.toLocaleString()}{' '}
                  <span className="text-base font-medium text-gray-500 dark:text-gray-400">
                    {stats.untilNext === 1 ? 'day' : 'days'}
                  </span>
                </span>
                <span className={STAT_SECONDARY}>{formatShortDate(stats.nextDate)}</span>
              </>
            )}
          </div>

          <div className={STAT_CARD}>
            <span className={STAT_LABEL}>Born on</span>
            <span className={STAT_PRIMARY}>{stats.bornOn}</span>
            <span className={STAT_SECONDARY}>{formatShortDate(validBirth!)}</span>
          </div>

          <div className={STAT_CARD}>
            <span className={STAT_LABEL}>Total days lived</span>
            <span className={STAT_PRIMARY}>{stats.totalDays.toLocaleString()}</span>
            <span className={STAT_SECONDARY}>
              ≈ {Math.floor(stats.totalDays / 7).toLocaleString()} weeks
            </span>
          </div>
        </div>
      ) : (
        <div className={`${CARD} text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pick a date above to see your age and next birthday.
          </p>
        </div>
      )}
      </div>
    </div>
  )
}
