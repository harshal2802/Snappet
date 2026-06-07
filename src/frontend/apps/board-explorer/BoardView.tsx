import { useMemo } from 'react'
import type { Bounds, RenderHold } from './render'
import type { HoldPos, SizeBox } from './types'

interface Props {
  /** The climb's holds, coloured by role. */
  holds: RenderHold[]
  /** The climb's layout holds, drawn faint as the board grid. */
  grid: HoldPos[]
  bounds: Bounds
  /** Optional size frame to overlay (the selected board size). */
  sizeBox?: SizeBox | null
  label: string
}

const PAD = 10

export default function BoardView({ holds, grid, bounds, sizeBox, label }: Props) {
  const { minX, maxX, minY, maxY } = bounds
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  // Board y increases upward; SVG y increases downward — flip around the box.
  const fy = (y: number): number => minY + maxY - y
  const r = Math.max(w, h) / 55

  const vb = `${minX - PAD} ${minY - PAD} ${w + 2 * PAD} ${h + 2 * PAD}`

  // Memoise the grid dots (the biggest list — a few hundred per layout). The y-flip
  // is inlined (minY + maxY - y) so the memo's deps stay explicit.
  const dots = useMemo(
    () =>
      grid.map((p) => (
        <circle
          key={p.placementId}
          cx={p.x}
          cy={minY + maxY - p.y}
          r={r * 0.42}
          className="fill-gray-300 dark:fill-gray-600"
        />
      )),
    [grid, r, minY, maxY],
  )

  return (
    <svg
      role="img"
      aria-label={`Board layout for ${label}`}
      viewBox={vb}
      width={w + 2 * PAD}
      height={h + 2 * PAD}
      className="mx-auto max-h-[60vh] max-w-full h-auto"
    >
      {/* Wall backdrop */}
      <rect
        x={minX - PAD / 2}
        y={minY - PAD / 2}
        width={w + PAD}
        height={h + PAD}
        rx={r}
        className="fill-gray-100 dark:fill-gray-800/60"
      />

      {dots}

      {/* Selected board size frame */}
      {sizeBox && (
        <rect
          x={sizeBox[0]}
          y={fy(sizeBox[3])}
          width={Math.max(0, sizeBox[1] - sizeBox[0])}
          height={Math.max(0, sizeBox[3] - sizeBox[2])}
          fill="none"
          strokeWidth={r * 0.35}
          strokeDasharray={`${r} ${r}`}
          className="stroke-gray-400 dark:stroke-gray-500"
        />
      )}

      {/* The climb's holds — coloured rings by role */}
      {holds.map((hold, i) => (
        <circle
          key={`${hold.x}:${hold.y}:${i}`}
          cx={hold.x}
          cy={fy(hold.y)}
          r={r * 1.15}
          fill="none"
          stroke={hold.color}
          strokeWidth={r * 0.55}
        />
      ))}
    </svg>
  )
}
