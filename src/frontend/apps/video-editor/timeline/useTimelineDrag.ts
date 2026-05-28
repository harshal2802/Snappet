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

export function useTimelineDrag(opts: DragOpts): DragHandlers {
  const ref = useRef<{ x0: number; pointerId: number; dragging: boolean }>({
    x0: 0,
    pointerId: -1,
    dragging: false,
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only respond to primary button or touch.
      if (e.button !== 0 && e.pointerType === 'mouse') return
      ref.current.x0 = e.clientX
      ref.current.pointerId = e.pointerId
      ref.current.dragging = true
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      opts.onDragStart?.()
      e.stopPropagation()
    },
    [opts],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!ref.current.dragging || e.pointerId !== ref.current.pointerId) return
      const dxPx = e.clientX - ref.current.x0
      opts.onDragMove(dxPx / opts.pxPerSec)
    },
    [opts],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!ref.current.dragging || e.pointerId !== ref.current.pointerId) return
      ref.current.dragging = false
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
      opts.onDragEnd?.()
    },
    [opts],
  )

  return { onPointerDown, onPointerMove, onPointerUp }
}
