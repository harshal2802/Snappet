import { useEditorStore } from '../state/editorStore'
import { useTimelineDrag } from './useTimelineDrag'
import { useRef } from 'react'

export default function Playhead() {
  const zoom = useEditorStore((s) => s.zoomPxPerSec)
  const playhead = useEditorStore((s) => s.playhead)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const startAt = useRef(playhead)

  const drag = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      startAt.current = playhead
    },
    onDragMove: (dxSec) => {
      setPlayhead(startAt.current + dxSec)
    },
  })

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-20"
      style={{ left: playhead * zoom }}
    >
      <div className="absolute top-0 bottom-0 w-px bg-red-500" />
      <div
        {...drag}
        className="pointer-events-auto absolute -left-2 -top-1 h-3 w-4 cursor-ew-resize rounded-sm bg-red-500 shadow"
        aria-label="Playhead"
      />
    </div>
  )
}
