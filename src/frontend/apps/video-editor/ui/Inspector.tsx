import { useEditorStore } from '../state/editorStore'

export default function Inspector() {
  const selection = useEditorStore((s) => s.selection)
  const clip = useEditorStore((s) =>
    selection?.kind === 'clip' ? s.project.clips[selection.id] : null,
  )
  const asset = useEditorStore((s) =>
    clip ? s.assets[clip.assetId] : null,
  )

  if (!clip) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Select a clip to see its properties.
      </div>
    )
  }

  const dur = clip.outSec - clip.inSec

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Clip
        </div>
        <div
          className="truncate font-medium text-gray-900 dark:text-gray-100"
          title={asset?.name}
        >
          {asset?.name ?? clip.assetId}
        </div>
      </div>
      <Row label="Start" value={`${clip.startSec.toFixed(3)}s`} />
      <Row label="In" value={`${clip.inSec.toFixed(3)}s`} />
      <Row label="Out" value={`${clip.outSec.toFixed(3)}s`} />
      <Row label="Duration" value={`${dur.toFixed(3)}s`} />
      {asset && (
        <Row label="Source" value={`${asset.width}×${asset.height} · ${asset.fps.toFixed(0)}fps`} />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-mono text-xs tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  )
}
