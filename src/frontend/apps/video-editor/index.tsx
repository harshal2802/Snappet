import { useEffect, useMemo } from 'react'
import { detectCapabilities, isEditorSupported } from './support/caps'
import UnsupportedBrowser from './support/UnsupportedBrowser'
import Dropzone from './ui/Dropzone'
import MediaBin from './ui/MediaBin'
import Timeline from './timeline/Timeline'
import Toolbar from './ui/Toolbar'
import Inspector from './ui/Inspector'
import Player from './ui/Player'
import ExportDialog from './ui/ExportDialog'
import { useEditorStore } from './state/editorStore'
import { totalDurationSec } from './state/selectors'

export default function VideoEditor() {
  const caps = useMemo(() => detectCapabilities(), [])
  const supported = isEditorSupported(caps)
  const rehydrate = useEditorStore((s) => s.rehydrateFromOpfs)
  const resetAll = useEditorStore((s) => s.resetAll)
  const project = useEditorStore((s) => s.project)
  const exportDialogOpen = useEditorStore((s) => s.exportDialogOpen)
  const setExportDialogOpen = useEditorStore((s) => s.setExportDialogOpen)

  useEffect(() => {
    if (supported) void rehydrate()
  }, [supported, rehydrate])

  if (!supported) {
    return <UnsupportedBrowser caps={caps} />
  }

  const duration = totalDurationSec(project)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Video Editor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Strictly client-side · WebCodecs · Your media never leaves the device.
          </p>
        </div>
        <button
          onClick={() => {
            if (
              window.confirm(
                'Remove all assets and clear local storage? This cannot be undone.',
              )
            ) {
              void resetAll()
            }
          }}
          className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-400"
          title="Remove all assets"
        >
          ↺ Reset
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr_240px]">
        <aside className="space-y-3">
          <Dropzone />
          <MediaBin />
        </aside>
        <main className="space-y-3">
          <Player />
        </main>
        <aside>
          <Inspector />
        </aside>
      </div>

      <div className="space-y-2">
        <Toolbar />
        <Timeline />
      </div>

      {duration > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Total duration: {duration.toFixed(2)}s · {project.tracks.length} tracks
        </div>
      )}

      {exportDialogOpen && (
        <ExportDialog onClose={() => setExportDialogOpen(false)} />
      )}
    </div>
  )
}
