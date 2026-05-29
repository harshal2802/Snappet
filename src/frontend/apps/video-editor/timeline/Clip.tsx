import { useRef } from 'react'
import { useEditorStore } from '../state/editorStore'
import { useTimelineDrag } from './useTimelineDrag'
import { clipTimelineEnd } from '../state/selectors'
import type { Clip as ClipModel } from '../types/timeline'

interface Props {
  clip: ClipModel
}

// Snap a proposed clip start to nearby edges (other clips' start/end, playhead,
// timeline start) within a fixed screen-pixel threshold converted to seconds.
function snapStart(
  proposed: number,
  durSec: number,
  selfId: string,
  zoom: number,
): number {
  const thr = 8 / zoom
  const { project, playhead } = useEditorStore.getState()
  const targets = [0, playhead]
  for (const c of Object.values(project.clips)) {
    if (c.id === selfId) continue
    targets.push(c.startSec, clipTimelineEnd(c))
  }
  let best = proposed
  let bestDist = thr
  for (const t of targets) {
    const dStart = Math.abs(proposed - t)
    if (dStart < bestDist) {
      bestDist = dStart
      best = t
    }
    const dEnd = Math.abs(proposed + durSec - t)
    if (dEnd < bestDist) {
      bestDist = dEnd
      best = t - durSec
    }
  }
  return Math.max(0, best)
}

export default function Clip({ clip }: Props) {
  const zoom = useEditorStore((s) => s.zoomPxPerSec)
  const moveClip = useEditorStore((s) => s.moveClip)
  const trimClip = useEditorStore((s) => s.trimClip)
  const selection = useEditorStore((s) => s.selection)
  const selectClip = useEditorStore((s) => s.selectClip)
  const asset = useEditorStore((s) => s.assets[clip.assetId])
  const isSelected =
    selection?.kind === 'clip' && selection.id === clip.id

  const speed = clip.speed ?? 1
  const dur = (clip.outSec - clip.inSec) / speed // timeline duration
  const left = clip.startSec * zoom
  const width = Math.max(8, dur * zoom)

  const startAtDragStart = useRef(clip.startSec)
  const inAtDragStart = useRef(clip.inSec)
  const outAtDragStart = useRef(clip.outSec)

  const bodyDrag = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      startAtDragStart.current = clip.startSec
      selectClip(clip.id)
    },
    onDragMove: (dxSec) => {
      const proposed = Math.max(0, startAtDragStart.current + dxSec)
      moveClip(clip.id, snapStart(proposed, dur, clip.id, zoom))
    },
  })

  const inDrag = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      inAtDragStart.current = clip.inSec
      startAtDragStart.current = clip.startSec
      selectClip(clip.id)
    },
    onDragMove: (dxSec) => {
      // Dragging the in-handle shifts both startSec on the timeline and inSec on the
      // asset so the trailing portion stays put. dxSec is timeline time; source time
      // moves by dxSec * speed.
      const srcDelta = dxSec * speed
      const newIn = inAtDragStart.current + srcDelta
      const clampedIn = Math.max(0, Math.min(newIn, clip.outSec - 0.05))
      const appliedTimelineDelta = (clampedIn - inAtDragStart.current) / speed
      trimClip(clip.id, 'in', clampedIn)
      moveClip(clip.id, startAtDragStart.current + appliedTimelineDelta)
    },
  })

  const outDrag = useTimelineDrag({
    pxPerSec: zoom,
    onDragStart: () => {
      outAtDragStart.current = clip.outSec
      selectClip(clip.id)
    },
    onDragMove: (dxSec) => {
      trimClip(clip.id, 'out', outAtDragStart.current + dxSec * speed)
    },
  })

  return (
    <div
      onClick={() => selectClip(clip.id)}
      style={{ left, width }}
      className={
        'absolute top-1 bottom-1 select-none overflow-hidden rounded border shadow-sm transition ' +
        (isSelected
          ? 'border-blue-400 ring-2 ring-blue-300'
          : 'border-gray-300 dark:border-gray-600')
      }
    >
      <div
        className="absolute inset-0 flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: asset?.thumbnailDataUrl
            ? `url(${asset.thumbnailDataUrl})`
            : undefined,
          backgroundColor: 'rgba(37, 99, 235, 0.8)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 truncate bg-black/40 px-1 text-[10px] font-medium text-white">
        {asset?.name ?? clip.assetId}
      </div>
      {/* In handle */}
      <div
        {...inDrag}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/40 hover:bg-white/70"
      />
      {/* Body */}
      <div
        {...bodyDrag}
        className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
      />
      {/* Out handle */}
      <div
        {...outDrag}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/40 hover:bg-white/70"
      />
    </div>
  )
}
