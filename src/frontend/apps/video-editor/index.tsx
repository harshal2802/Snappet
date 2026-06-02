import { useEffect, useMemo, useState } from 'react'
import { detectCapabilities, isEditorSupported } from './support/caps'
import { useIsMobile } from './support/useMediaQuery'
import UnsupportedBrowser from './support/UnsupportedBrowser'
import Dropzone from './ui/Dropzone'
import MediaBin from './ui/MediaBin'
import Timeline from './timeline/Timeline'
import Toolbar from './ui/Toolbar'
import Inspector from './ui/Inspector'
import Player from './ui/Player'
import ExportDialog from './ui/ExportDialog'
import BottomSheet from './ui/BottomSheet'
import ConfirmDialog from './ui/ConfirmDialog'
import { useEditorStore } from './state/editorStore'
import { totalDurationSec } from './state/selectors'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'

export default function VideoEditor() {
  const caps = useMemo(() => detectCapabilities(), [])
  const supported = isEditorSupported(caps)
  const isMobile = useIsMobile()
  const rehydrate = useEditorStore((s) => s.rehydrateFromOpfs)
  const resetAll = useEditorStore((s) => s.resetAll)
  const project = useEditorStore((s) => s.project)
  const selection = useEditorStore((s) => s.selection)
  const exportDialogOpen = useEditorStore((s) => s.exportDialogOpen)
  const setExportDialogOpen = useEditorStore((s) => s.setExportDialogOpen)

  const [mediaOpen, setMediaOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (supported) void rehydrate()
  }, [supported, rehydrate])

  // Selecting a clip should NOT take over the screen — it just highlights the clip
  // and enables the toolbar + bottom "Edit" button. Only auto-CLOSE Properties when
  // the selection is cleared (e.g. after delete) so a stale sheet doesn't linger.
  useEffect(() => {
    if (!selection) setPropsOpen(false)
  }, [selection])

  if (!supported) {
    return <UnsupportedBrowser caps={caps} />
  }

  const duration = totalDurationSec(project)

  const header = (
    <header
      className="flex items-center justify-between gap-3"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 md:text-2xl">
          Video Editor
        </h1>
        <p className="hidden text-sm text-gray-500 dark:text-gray-400 sm:block">
          Strictly client-side · WebCodecs · Your media never leaves the device.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <GuidedTour appId="video-editor" steps={tourSteps} />
        <button
          onClick={() => setConfirmReset(true)}
          className="flex h-10 items-center rounded-md px-3 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-400"
          title="Remove all assets"
        >
          ↺ Reset
        </button>
      </div>
    </header>
  )

  const reset = (
    <ConfirmDialog
      open={confirmReset}
      title="Reset project?"
      message="Remove all assets and clear local storage? This cannot be undone."
      confirmLabel="Reset"
      destructive
      onConfirm={() => {
        setConfirmReset(false)
        void resetAll()
      }}
      onCancel={() => setConfirmReset(false)}
    />
  )

  const exportDlg = exportDialogOpen && (
    <ExportDialog onClose={() => setExportDialogOpen(false)} />
  )

  if (isMobile) {
    return (
      <div
        className="ve-root flex min-h-[100dvh] flex-col gap-2 px-2 pt-2"
        style={{ paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}
      >
        {header}
        <Player />
        <Toolbar />
        <Timeline />
        {duration > 0 && (
          <div className="px-1 text-xs text-gray-500 dark:text-gray-400">
            {duration.toFixed(2)}s · {project.tracks.length} tracks
          </div>
        )}

        {/* Bottom action bar (thumb zone) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-2 border-t border-gray-200 bg-white/95 px-3 pt-2 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setMediaOpen(true)}
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span className="text-lg leading-none">＋</span>
            Media
          </button>
          <button
            onClick={() => setPropsOpen(true)}
            disabled={!selection}
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span className="text-lg leading-none">⚙</span>
            Edit
          </button>
          <button
            onClick={() => setExportDialogOpen(true)}
            disabled={duration <= 0}
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <span className="text-lg leading-none">⬆</span>
            Export
          </button>
        </nav>

        <BottomSheet
          open={mediaOpen}
          onClose={() => setMediaOpen(false)}
          title="Media"
          size="large"
        >
          <div className="space-y-3">
            <Dropzone />
            <MediaBin onAddClip={() => setMediaOpen(false)} />
          </div>
        </BottomSheet>

        <BottomSheet
          open={propsOpen}
          onClose={() => setPropsOpen(false)}
          title="Properties"
          size="medium"
          modal={false}
        >
          <Inspector />
        </BottomSheet>

        {reset}
        {exportDlg}
      </div>
    )
  }

  // Desktop / tablet
  return (
    <div className="ve-root mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      {header}

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

      {reset}
      {exportDlg}
    </div>
  )
}
