import { Link } from 'react-router-dom'
import type { AppRoute } from '../../router/routes'
import { relativeTime, usageStats } from '../../lib/usage'
import type { UsageMap } from '../../lib/usage'

interface Props {
  routes: AppRoute[]
  usage: UsageMap
  onReset: () => void
}

interface Ranked {
  route: AppRoute
  count: number
  last: number
}

export default function Dashboard({ routes, usage, onReset }: Props) {
  const used: Ranked[] = routes
    .map((route) => ({
      route,
      count: usage[route.path]?.count ?? 0,
      last: usage[route.path]?.last ?? 0,
    }))
    .filter((r) => r.count > 0)

  if (used.length === 0) return null // nothing to show on a fresh device

  const stats = usageStats(usage)
  const mostUsed = [...used].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 6)
  const recent = [...used].sort((a, b) => b.last - a.last).slice(0, 5)
  const max = mostUsed[0]?.count || 1

  return (
    <section
      aria-label="Your usage dashboard"
      className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 dark:border-gray-700 dark:from-gray-800/60 dark:to-gray-900"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Your dashboard
        </h2>
        <button
          onClick={onReset}
          className="rounded-md px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800 dark:hover:text-red-400"
          title="Clear usage stats"
        >
          ↺ Reset stats
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat value={stats.totalOpens} label="Total opens" />
        <Stat value={stats.toolsUsed} label={`of ${routes.length} tools used`} />
        <Stat value={mostUsed[0]?.route.label ?? '—'} label="Top tool" small />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Most used */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Most used
          </h3>
          <ol className="space-y-1.5">
            {mostUsed.map((r) => (
              <li key={r.route.path}>
                <Link
                  to={r.route.path}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="w-5 text-base" aria-hidden>
                    {r.route.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-800 dark:text-gray-200">
                      {r.route.label}
                    </span>
                    <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <span
                        className="block h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {r.count}×
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        {/* Recently used */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Recently used
          </h3>
          <ul className="space-y-1.5">
            {recent.map((r) => (
              <li key={r.route.path}>
                <Link
                  to={r.route.path}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="w-5 text-base" aria-hidden>
                    {r.route.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200">
                    {r.route.label}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {relativeTime(r.last)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Stat({
  value,
  label,
  small,
}: {
  value: string | number
  label: string
  small?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
      <div
        className={
          'truncate font-bold text-gray-900 dark:text-gray-100 ' +
          (small ? 'text-base' : 'text-2xl')
        }
      >
        {value}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}
