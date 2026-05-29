import { useMemo, useRef } from 'react'
import { useEditorStore } from '../state/editorStore'
import { useTimelineDrag } from './useTimelineDrag'
import type { TextOverlay } from '../types/timeline'

export default function TextTrack() {
  const overlayMap = useEditorStore((s) => s.project.textOverlays)
  const overlays = useMemo(
    () => Object.values(overlayMap ?? {}),
    [overlayMap],
  )
  if (overlays.length === 0) return null
  return (
    <div className="relative h-9 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <div className="absolute left-1 top-1 z-10 rounded bg-white/80 px-1 text-[9px] font-medium text-gray-600 shadow-sm dark:bg-gray-900/80 dark:text-gray-400">
        text
      </div>
      {overlays.map((o) => (
        <TextBlock key={o.id} overlay={o} />
      ))}
    </div>
  )
}

function TextBlock({ overlay: o }: { overlay: TextOverlay }) {
  const zoom = useEditorStore((s) => s.zoomPxPerSec)
  const update = useEditorStore((s) => s.updateTextOverlay)
  const selectText = useEditorStore((s) => s.selectText)
  const selection = useEditorStore((s) => s.selection)
  const isSelected = selection?.kind === 'text' && selection.id === o.id

  const startAt = useRef(o.startSec)
  const endAt = useRef(o.endSec)
  const dur = o.endSec - o.startSec

  const body = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      startAt.current = o.startSec
      endAt.current = o.endSec
      selectText(o.id)
    },
    onDragMove: (dx) => {
      const ns = Math.max(0, startAt.current + dx)
      update(o.id, { startSec: ns, endSec: ns + (endAt.current - startAt.current) })
    },
  })

  const left = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      startAt.current = o.startSec
      selectText(o.id)
    },
    onDragMove: (dx) => {
      update(o.id, {
        startSec: Math.max(0, Math.min(startAt.current + dx, o.endSec - 0.2)),
      })
    },
  })

  const right = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      endAt.current = o.endSec
      selectText(o.id)
    },
    onDragMove: (dx) => {
      update(o.id, { endSec: Math.max(o.startSec + 0.2, endAt.current + dx) })
    },
  })

  return (
    <div
      data-clip-body
      onClick={() => selectText(o.id)}
      style={{ left: o.startSec * zoom, width: Math.max(8, dur * zoom) }}
      className={
        'absolute top-1 bottom-1 select-none overflow-hidden rounded border text-[10px] ' +
        (isSelected
          ? 'border-blue-400 ring-2 ring-blue-300'
          : 'border-purple-300 dark:border-purple-700')
      }
    >
      <div
        {...left}
        className="ve-grab absolute left-0 top-0 bottom-0 z-10 flex w-4 cursor-ew-resize items-center justify-center md:w-2"
      >
        <span className="h-full w-2 bg-white/50 md:w-full" />
      </div>
      <div
        {...body}
        className="ve-grab absolute inset-x-4 inset-y-0 flex cursor-grab items-center truncate bg-purple-500/80 px-2 text-white active:cursor-grabbing md:inset-x-2"
      >
        T {o.text || ' '}
      </div>
      <div
        {...right}
        className="ve-grab absolute right-0 top-0 bottom-0 z-10 flex w-4 cursor-ew-resize items-center justify-center md:w-2"
      >
        <span className="h-full w-2 bg-white/50 md:w-full" />
      </div>
    </div>
  )
}
