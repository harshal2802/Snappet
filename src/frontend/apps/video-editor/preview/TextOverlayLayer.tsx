import { useRef } from 'react'
import { useEditorStore } from '../state/editorStore'
import { activeTextOverlays } from '../state/selectors'
import type { TextOverlay } from '../types/timeline'

// Renders text overlays as draggable DOM positioned over the preview canvas.
// Coordinates are normalized (0–1) so they map 1:1 to the export's ctx.fillText.
export default function TextOverlayLayer() {
  const project = useEditorStore((s) => s.project)
  const playhead = useEditorStore((s) => s.playhead)
  const overlays = activeTextOverlays(project, playhead)
  if (overlays.length === 0) return null
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ containerType: 'size' }}
    >
      {overlays.map((o) => (
        <OverlayItem key={o.id} overlay={o} />
      ))}
    </div>
  )
}

function OverlayItem({ overlay: o }: { overlay: TextOverlay }) {
  const update = useEditorStore((s) => s.updateTextOverlay)
  const selectText = useEditorStore((s) => s.selectText)
  const selection = useEditorStore((s) => s.selection)
  const isSelected = selection?.kind === 'text' && selection.id === o.id
  const drag = useRef<{ active: boolean; pid: number } | null>(null)

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        selectText(o.id)
        drag.current = { active: true, pid: e.pointerId }
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current?.active || e.pointerId !== drag.current.pid) return
        const parent = (e.currentTarget as HTMLElement).parentElement
        if (!parent) return
        const rect = parent.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        update(o.id, { x, y })
      }}
      onPointerUp={(e) => {
        if (drag.current) drag.current.active = false
        ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${o.x * 100}%`,
        top: `${o.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${o.fontSize * 100}cqh`,
        fontWeight: o.bold ? 700 : 400,
        color: o.color,
        textAlign: o.align,
        background: o.bg ? 'rgba(0,0,0,0.45)' : 'transparent',
        padding: o.bg ? '0.1em 0.3em' : 0,
        borderRadius: o.bg ? '0.15em' : 0,
        whiteSpace: 'pre-wrap',
        lineHeight: 1.15,
        textShadow: o.bg ? 'none' : '0 1px 3px rgba(0,0,0,0.6)',
        maxWidth: '90%',
      }}
      className={
        'pointer-events-auto cursor-move touch-none ring-offset-0 ' +
        (isSelected ? 'outline outline-2 outline-blue-400' : '')
      }
    >
      {o.text || ' '}
    </div>
  )
}
