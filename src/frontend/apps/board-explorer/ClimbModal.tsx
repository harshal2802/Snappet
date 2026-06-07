import { useEffect, useMemo, useState } from 'react'
import BoardView from './BoardView'
import {
  buildRenderHolds,
  indexPlacements,
  indexRoles,
  layoutBounds,
  unionBounds,
  type Bounds,
  type RenderHold,
} from './render'
import type { BoardDB } from './db'
import type { BoardMeta, ClimbDetail, ClimbRow, SizeBox } from './types'

interface Props {
  db: BoardDB
  meta: BoardMeta
  row: ClimbRow
  sizeBox: SizeBox | null
  onClose: () => void
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function holdsBounds(holds: RenderHold[]): Bounds | null {
  if (!holds.length) return null
  return holds.reduce<Bounds>(
    (b, h) => ({
      minX: Math.min(b.minX, h.x),
      maxX: Math.max(b.maxX, h.x),
      minY: Math.min(b.minY, h.y),
      maxY: Math.max(b.maxY, h.y),
    }),
    { minX: holds[0].x, maxX: holds[0].x, minY: holds[0].y, maxY: holds[0].y },
  )
}

export default function ClimbModal({ db, meta, row, sizeBox, onClose }: Props) {
  const [detail, setDetail] = useState<ClimbDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    db.getClimb(row.uuid)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [db, row.uuid])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const placementMap = useMemo(() => indexPlacements(meta.placements), [meta.placements])
  const roleMap = useMemo(() => indexRoles(meta.roles), [meta.roles])

  const view = useMemo(() => {
    if (!detail) return null
    const holds = buildRenderHolds(detail.frames, placementMap, roleMap)
    const grid = meta.placements.filter((p) => p.layoutId === detail.layoutId)
    const gb = layoutBounds(meta.placements, detail.layoutId)
    const hb = holdsBounds(holds)
    const bounds = gb && hb ? unionBounds(gb, hb) : (gb ?? hb ?? { minX: 0, maxX: 100, minY: 0, maxY: 100 })
    const legend = Array.from(new Map(holds.filter((h) => h.roleName).map((h) => [h.roleName, h])).values())
    return { holds, grid, bounds, legend }
  }, [detail, meta.placements, placementMap, roleMap])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${row.name || 'Climb'} on the board`}
        className="relative w-full max-w-md max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{row.name || 'Untitled'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-mono">{row.grade}</span> · {row.angle}° · {row.ascents.toLocaleString()} ascents
              {row.setter && <> · {row.setter}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            ✕
          </button>
        </div>

        {loading && <p className="py-10 text-center text-gray-400">Loading climb…</p>}
        {error && <p className="py-10 text-center text-red-500">{error}</p>}
        {!loading && !error && !detail && <p className="py-10 text-center text-gray-400">Climb not found.</p>}

        {view && (
          <>
            <BoardView holds={view.holds} grid={view.grid} bounds={view.bounds} sizeBox={sizeBox} label={row.name || row.uuid} />
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
              {view.legend.map((h) => (
                <span key={h.roleName} className="inline-flex items-center gap-1.5">
                  <svg width="12" height="12" aria-hidden="true" className="shrink-0">
                    <circle cx="6" cy="6" r="4" fill="none" stroke={h.color} strokeWidth="2.5" />
                  </svg>
                  {capitalize(h.roleName)}
                </span>
              ))}
              {sizeBox && (
                <span className="inline-flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <svg width="12" height="12" aria-hidden="true" className="shrink-0">
                    <rect x="1" y="1" width="10" height="10" fill="none" strokeWidth="1.5" strokeDasharray="2 2" className="stroke-current" />
                  </svg>
                  Selected size
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
