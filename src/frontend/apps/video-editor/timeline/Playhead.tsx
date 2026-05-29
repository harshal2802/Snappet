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
      {/* Grab head: large transparent hit column with a visible knob on top */}
      <div
        {...drag}
        className="ve-grab pointer-events-auto absolute -top-1 bottom-0 -left-5 flex w-10 cursor-ew-resize justify-center"
        aria-label="Playhead"
      >
        <span className="h-4 w-4 rounded-sm bg-red-500 shadow" />
      </div>
    </div>
  )
}
