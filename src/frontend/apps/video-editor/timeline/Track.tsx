import { useEditorStore } from '../state/editorStore'
import Clip from './Clip'
import type { Track as TrackModel } from '../types/timeline'

interface Props {
  track: TrackModel
}

export default function Track({ track }: Props) {
  const clips = useEditorStore((s) =>
    Object.values(s.project.clips).filter((c) => c.trackId === track.id),
  )
  const addClipFromAsset = useEditorStore((s) => s.addClipFromAsset)
  const playhead = useEditorStore((s) => s.playhead)

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
          addClipFromAsset(assetId, playhead)
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
