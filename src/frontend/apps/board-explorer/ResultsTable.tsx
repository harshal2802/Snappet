import type { ClimbRow } from './types'

interface Props {
  rows: ClimbRow[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  onPage: (page: number) => void
}

export default function ResultsTable({ rows, total, page, pageSize, loading, onPage }: Props) {
  const start = total === 0 ? 0 : page * pageSize + 1
  const end = Math.min(total, page * pageSize + rows.length)
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)

  return (
    <div data-tour="results" className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          {loading ? 'Searching…' : total === 0 ? 'No climbs match' : `Showing ${start}–${end} of ${total.toLocaleString()}`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Grade</th>
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-right px-3 py-2 font-medium">Angle</th>
              <th className="text-right px-3 py-2 font-medium">Ascents</th>
              <th className="text-right px-3 py-2 font-medium">★</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Setter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.uuid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {r.grade}
                  {r.benchmark && (
                    <span
                      title="Benchmark"
                      className="ml-1 text-amber-500"
                      aria-label="benchmark"
                    >
                      ◆
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.angle}°</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {r.ascents.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {r.quality.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{r.setter}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Try widening your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <PageBtn disabled={page <= 0} onClick={() => onPage(page - 1)}>
            ← Prev
          </PageBtn>
          <span className="text-gray-500 dark:text-gray-400">
            Page {page + 1} of {lastPage + 1}
          </span>
          <PageBtn disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
            Next →
          </PageBtn>
        </div>
      )}
    </div>
  )
}

function PageBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {children}
    </button>
  )
}
