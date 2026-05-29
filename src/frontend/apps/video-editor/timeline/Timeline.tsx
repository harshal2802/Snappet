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

  const duration = totalDurationSec(project)
  const contentWidth = Math.max(800, (duration + 10) * zoom)

  return (
    <div
      ref={scrollerRef}
      id="ve-timeline-scroller"
      onWheel={(e) => {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
          setZoom(zoom * factor)
        }
      }}
      onClick={(e) => {
        // Click empty timeline area to set playhead.
        const target = e.target as HTMLElement
        if (target.closest('[data-clip-body]')) return
        const rect = (
          e.currentTarget.firstChild as HTMLDivElement
        ).getBoundingClientRect()
        const scrollLeft = e.currentTarget.scrollLeft
        const x = e.clientX - rect.left + scrollLeft
        if (x >= 0) setPlayhead(x / zoom)
      }}
      className="relative overflow-x-auto overflow-y-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
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
