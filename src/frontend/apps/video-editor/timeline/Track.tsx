import { useMemo } from 'react'
import { useEditorStore } from '../state/editorStore'
import Clip from './Clip'
import type { Track as TrackModel } from '../types/timeline'

interface Props {
  track: TrackModel
}

export default function Track({ track }: Props) {
  // Subscribe to the stable clips map (only changes when clips change) and derive
  // this track's clips in a memo — filtering inside the selector would allocate a
  // new array on every store update and re-render the track on each playhead tick.
  const clipMap = useEditorStore((s) => s.project.clips)
  const clips = useMemo(
    () => Object.values(clipMap).filter((c) => c.trackId === track.id),
    [clipMap, track.id],
  )
  const addClipFromAsset = useEditorStore((s) => s.addClipFromAsset)

  return (
    <div
      onDragOver={(e) => {
        if (track.kind === 'video') e.preventDefault()
      }}
      onDrop={(e) => {
        if (track.kind !== 'video') return
        const assetId = e.dataTransfer.getData('text/x-snappet-asset')
        if (assetId) {
          e.preventDefault()
          // Read playhead lazily so the track doesn't re-subscribe to it.
          addClipFromAsset(assetId, useEditorStore.getState().playhead)
        }
      }}
      className="relative h-12 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="absolute left-1 top-1 z-10 rounded bg-white/80 px-1 text-[9px] font-medium text-gray-600 shadow-sm dark:bg-gray-900/80 dark:text-gray-400">
        {track.kind}
      </div>
      {clips.map((c) => (
        <Clip key={c.id} clip={c} />
      ))}
    </div>
  )
}
