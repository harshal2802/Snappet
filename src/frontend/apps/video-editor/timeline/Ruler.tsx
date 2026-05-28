import { useEditorStore } from '../state/editorStore'

export default function Ruler({ widthPx }: { widthPx: number }) {
  const zoom = useEditorStore((s) => s.zoomPxPerSec)
  // Choose tick interval based on zoom so labels stay readable.
  const tickInterval =
    zoom > 200 ? 0.5 : zoom > 50 ? 1 : zoom > 20 ? 5 : 10
  const labelInterval = tickInterval * (zoom > 200 ? 2 : 5)

  const totalSec = Math.max(1, Math.ceil(widthPx / zoom) + 1)
  const ticks: number[] = []
  for (let t = 0; t <= totalSec; t += tickInterval) {
    ticks.push(t)
  }

  return (
    <div className="relative h-6 border-b border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
      {ticks.map((t) => {
        const isLabel = Math.abs((t / labelInterval) - Math.round(t / labelInterval)) < 1e-6
        return (
          <div
            key={t}
            className="absolute top-0 bottom-0"
            style={{ left: t * zoom }}
          >
            <div
              className={
                'w-px ' +
                (isLabel
                  ? 'h-full bg-gray-400 dark:bg-gray-500'
                  : 'h-1/2 bg-gray-300 dark:bg-gray-700')
              }
            />
            {isLabel && (
              <div className="absolute left-1 top-0 whitespace-nowrap text-[9px] text-gray-500 dark:text-gray-400">
                {formatRulerLabel(t)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatRulerLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (Number.isInteger(s)) return `${m}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
