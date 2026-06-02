import { useRef } from 'react'
import { useEditorStore } from '../state/editorStore'
import { totalDurationSec } from '../state/selectors'
import Track from './Track'
import TextTrack from './TextTrack'
import Ruler from './Ruler'
import Playhead from './Playhead'

export default function Timeline() {
  const project = useEditorStore((s) => s.project)
  const zoom = useEditorStore((s) => s.zoomPxPerSec)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const setZoom = useEditorStore((s) => s.setZoom)
  const scrollerRef = useRef<HTMLDivElement>(null)
  // Two-finger pinch-to-zoom (best-effort; +/− and Fit buttons are the reliable path).
  const pointers = useRef(new Map<number, number>())
  const pinch = useRef<{ baseDist: number; baseZoom: number }>({
    baseDist: 0,
    baseZoom: 100,
  })
  const pinched = useRef(false)

  const duration = totalDurationSec(project)
  const contentWidth = Math.max(800, (duration + 10) * zoom)

  const dist = (): number => {
    const xs = Array.from(pointers.current.values())
    return xs.length === 2 ? Math.abs(xs[0] - xs[1]) : 0
  }

  return (
    <div
      ref={scrollerRef}
      id="ve-timeline-scroller"
      data-tour="timeline"
      onWheel={(e) => {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
          setZoom(zoom * factor)
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return
        // Fresh gesture: clear any leftover pinch flag so it can't swallow a later tap.
        if (pointers.current.size === 0) pinched.current = false
        pointers.current.set(e.pointerId, e.clientX)
        if (pointers.current.size === 2) {
          pinch.current = { baseDist: dist(), baseZoom: zoom }
          pinched.current = true
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, e.clientX)
        if (pointers.current.size === 2 && pinch.current.baseDist > 0) {
          const d = dist()
          if (d > 0) setZoom(pinch.current.baseZoom * (d / pinch.current.baseDist))
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
      }}
      onClick={(e) => {
        // Suppress the click that follows a pinch gesture.
        if (pinched.current) {
          pinched.current = false
          return
        }
        // Tap empty timeline area to set the playhead.
        const target = e.target as HTMLElement
        if (target.closest('[data-clip-body]')) return
        const rect = (
          e.currentTarget.firstChild as HTMLDivElement
        ).getBoundingClientRect()
        const scrollLeft = e.currentTarget.scrollLeft
        const x = e.clientX - rect.left + scrollLeft
        if (x >= 0) setPlayhead(x / zoom)
      }}
      className="relative overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg border border-gray-200 bg-white [touch-action:pan-x] dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="relative" style={{ width: contentWidth }}>
        <Ruler widthPx={contentWidth} />
        {project.tracks.map((t) => (
          <Track key={t.id} track={t} />
        ))}
        <TextTrack />
        <Playhead />
      </div>
    </div>
  )
}
