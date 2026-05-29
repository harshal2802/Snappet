import { useStore } from 'zustand'
import { useEditorStore } from '../state/editorStore'
import { totalDurationSec } from '../state/selectors'
import { ASPECT_PRESETS } from '../types/timeline'

export default function Toolbar() {
  const canUndo = useStore(
    useEditorStore.temporal,
    (s) => s.pastStates.length > 0,
  )
  const canRedo = useStore(
    useEditorStore.temporal,
    (s) => s.futureStates.length > 0,
  )
  const split = useEditorStore((s) => s.splitClipAtPlayhead)
  const del = useEditorStore((s) => s.deleteSelection)
  const duplicate = useEditorStore((s) => s.duplicateClip)
  const addText = useEditorStore((s) => s.addTextOverlay)
  const zoom = useEditorStore((s) => s.zoomPxPerSec)
  const setZoom = useEditorStore((s) => s.setZoom)
  const project = useEditorStore((s) => s.project)
  const selection = useEditorStore((s) => s.selection)
  const setExportOpen = useEditorStore((s) => s.setExportDialogOpen)
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio)
  const aspect = project.aspectRatio ?? '16:9'
  const hasContent = totalDurationSec(project) > 0

  return (
    <div className="ve-toolbar flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1.5 [scrollbar-width:none] [&>*]:shrink-0 dark:border-gray-700 dark:bg-gray-800 md:flex-wrap md:gap-2 md:p-2">
      <button
        onClick={() => useEditorStore.temporal.getState().undo()}
        disabled={!canUndo}
        className="rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Undo (Ctrl/Cmd+Z)"
      >
        ↶
      </button>
      <button
        onClick={() => useEditorStore.temporal.getState().redo()}
        disabled={!canRedo}
        className="rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Redo (Ctrl/Cmd+Shift+Z)"
      >
        ↷
      </button>
      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
      <button
        onClick={() => split()}
        disabled={!hasContent}
        className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Split clip at playhead (S)"
      >
        ✂ Split
      </button>
      <button
        onClick={() => addText()}
        className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Add text overlay"
      >
        T+ Text
      </button>
      <button
        onClick={() => selection?.kind === 'clip' && duplicate(selection.id)}
        disabled={selection?.kind !== 'clip'}
        className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
        title="Duplicate clip (Ctrl/Cmd+D)"
      >
        ⧉ Duplicate
      </button>
      <button
        onClick={() => del()}
        disabled={!selection}
        className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-red-900/40 dark:hover:text-red-300"
        title="Delete selection (Backspace)"
      >
        🗑 Delete
      </button>

      {/* Aspect ratio */}
      <div className="ml-2 flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-gray-700">
        {ASPECT_PRESETS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAspectRatio(a.id)}
            className={
              'rounded px-2 py-1 text-xs font-medium transition ' +
              (aspect === a.id
                ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')
            }
            title={`Canvas ${a.label}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="ml-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <button
          onClick={() => setZoom(zoom / 1.5)}
          className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center font-mono">
          {Math.round(zoom)}px/s
        </span>
        <button
          onClick={() => setZoom(zoom * 1.5)}
          className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            const el = document.getElementById('ve-timeline-scroller')
            const dur = totalDurationSec(project)
            if (el && dur > 0) setZoom((el.clientWidth - 24) / (dur + 1))
          }}
          disabled={!hasContent}
          className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700"
          aria-label="Fit timeline to window"
          title="Fit to window"
        >
          ⤢
        </button>
      </div>
      <div className="ml-auto">
        <button
          onClick={() => setExportOpen(true)}
          disabled={!hasContent}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export
        </button>
      </div>
    </div>
  )
}
