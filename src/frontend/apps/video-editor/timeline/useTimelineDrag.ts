import { useCallback, useRef } from 'react'

interface DragHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

interface DragOpts {
  pxPerSec: number
  onDragStart?: () => void
  onDragMove: (dxSec: number) => void
  onDragEnd?: () => void
}

// Pointer-based drag with a small movement threshold: the drag only "commits" after
// the pointer moves >THRESHOLD px, so a tap selects a clip without nudging it, and a
// quick touch isn't misread as a drag.
const THRESHOLD_PX = 6

export function useTimelineDrag(opts: DragOpts): DragHandlers {
  const ref = useRef<{
    x0: number
    pointerId: number
    down: boolean
    dragging: boolean
  }>({
    x0: 0,
    pointerId: -1,
    down: false,
    dragging: false,
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      ref.current.x0 = e.clientX
      ref.current.pointerId = e.pointerId
      ref.current.down = true
      ref.current.dragging = false
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      e.stopPropagation()
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!ref.current.down || e.pointerId !== ref.current.pointerId) return
      const dxPx = e.clientX - ref.current.x0
      if (!ref.current.dragging) {
        if (Math.abs(dxPx) < THRESHOLD_PX) return
        ref.current.dragging = true
        opts.onDragStart?.()
      }
      opts.onDragMove(dxPx / opts.pxPerSec)
    },
    [opts],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!ref.current.down || e.pointerId !== ref.current.pointerId) return
      const wasDragging = ref.current.dragging
      ref.current.down = false
      ref.current.dragging = false
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
      if (wasDragging) opts.onDragEnd?.()
    },
    [opts],
  )

  return { onPointerDown, onPointerMove, onPointerUp }
}
