import { useRef } from 'react'
import { useEditorStore } from '../state/editorStore'
import { formatTimecode } from '../state/selectors'
import type { AssetId, MediaAsset } from '../types/timeline'

export default function MediaBin() {
  const assets = useEditorStore((s) => s.assets)
  const list = Object.values(assets)

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Media you import will appear here.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
      {list.map((a) => (
        <AssetCard key={a.id} asset={a} />
      ))}
    </div>
  )
}

function AssetCard({ asset }: { asset: MediaAsset }) {
  const removeAsset = useEditorStore((s) => s.removeAsset)
  const addClipFromAsset = useEditorStore((s) => s.addClipFromAsset)
  const playhead = useEditorStore((s) => s.playhead)
  const reLink = useReLink(asset.id)

  const isReady = asset.status === 'ready'
  const isIngesting = asset.status === 'ingesting'
  const isError = asset.status === 'error'
  const isMissing = asset.status === 'missing'

  return (
    <div
      onDoubleClick={() => {
        if (isReady) addClipFromAsset(asset.id, playhead)
      }}
      draggable={isReady}
      onDragStart={(e) => {
        if (isReady) e.dataTransfer.setData('text/x-snappet-asset', asset.id)
      }}
      className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
    >
      <div className="relative aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-900">
        {asset.thumbnailDataUrl ? (
          <img
            src={asset.thumbnailDataUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-400">
            🎞️
          </div>
        )}
        {isIngesting && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.round((asset.ingestProgress ?? 0) * 100)}%` }}
            />
          </div>
        )}
        {(isError || isMissing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
            {isError ? 'Error' : 'Re-link needed'}
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <div
          className="truncate text-xs font-medium text-gray-900 dark:text-gray-100"
          title={asset.name}
        >
          {asset.name}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
          <span>
            {formatTimecode(asset.durationSec).split('.')[0]}
            {asset.width > 0 && (
              <span className="ml-1">
                · {asset.width}×{asset.height}
              </span>
            )}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void removeAsset(asset.id)
            }}
            className="rounded p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300"
            title="Remove"
            aria-label={`Remove ${asset.name}`}
          >
            ✕
          </button>
        </div>
        {isError && asset.errorMessage && (
          <div className="text-[10px] text-red-600 dark:text-red-400">
            {asset.errorMessage}
          </div>
        )}
        {isMissing && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              reLink()
            }}
            className="w-full rounded bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            Re-link original
          </button>
        )}
      </div>
    </div>
  )
}

function useReLink(id: AssetId): () => void {
  const relinkAsset = useEditorStore((s) => s.relinkAsset)
  const inputRef = useRef<HTMLInputElement | null>(null)
  return () => {
    if (!inputRef.current) {
      const el = document.createElement('input')
      el.type = 'file'
      el.accept = 'video/*,image/*'
      el.onchange = () => {
        const f = el.files?.[0]
        if (f) void relinkAsset(id, f)
      }
      inputRef.current = el
    }
    inputRef.current.click()
  }
}
