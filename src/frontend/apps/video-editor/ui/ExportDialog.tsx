import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../state/editorStore'
import {
  EXPORT_PRESETS,
  ExportError,
  runExport,
} from '../export/exportPipeline'
import type { ExportProgress } from '../export/exportPipeline'
import { deliverFile } from '../media/share'

interface Props {
  onClose: () => void
}

type DialogState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: ExportProgress }
  | {
      kind: 'done'
      blob: Blob
      delivery: { kind: 'shared' | 'saved' | 'downloaded' | 'cancelled' }
    }
  | { kind: 'error'; message: string }

export default function ExportDialog({ onClose }: Props) {
  const project = useEditorStore((s) => s.project)
  const assets = useEditorStore((s) => s.assets)
  const sourceFiles = useEditorStore((s) => s.sourceFiles)
  const [presetIdx, setPresetIdx] = useState(1)
  const [filename, setFilename] = useState(
    `snappet-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`,
  )
  const [state, setState] = useState<DialogState>({ kind: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const preset = EXPORT_PRESETS[presetIdx]
  const missingMedia = useMemo(() => {
    const out: string[] = []
    for (const c of Object.values(project.clips)) {
      if (!sourceFiles.get(c.assetId)) {
        const a = assets[c.assetId]
        out.push(a?.name ?? c.assetId)
      }
    }
    return out
  }, [project.clips, sourceFiles, assets])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const onExport = async (): Promise<void> => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({
      kind: 'running',
      progress: { phase: 'preparing' },
    })
    try {
      const blob = await runExport(
        project,
        assets,
        (id) => sourceFiles.get(id),
        {
          width: preset.width,
          height: preset.height,
          fps: preset.fps,
          videoBitrate: preset.videoBitrate,
          audioBitrate: preset.audioBitrate,
          filename,
        },
        (p) => setState({ kind: 'running', progress: p }),
        ctrl.signal,
      )
      const delivery = await deliverFile(blob, filename)
      setState({ kind: 'done', blob, delivery })
    } catch (e) {
      const msg =
        e instanceof ExportError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e)
      setState({ kind: 'error', message: msg })
    } finally {
      abortRef.current = null
    }
  }

  const onCancel = (): void => {
    if (state.kind === 'running') {
      abortRef.current?.abort()
    } else {
      onClose()
    }
  }

  const onShareAgain = async (): Promise<void> => {
    if (state.kind === 'done') {
      await deliverFile(state.blob, filename)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl motion-safe:animate-[slideUp_200ms_ease-out] dark:bg-gray-800 sm:rounded-lg sm:motion-safe:animate-none"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Export video
        </h2>

        {state.kind === 'idle' && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Preset
              </legend>
              <div className="space-y-2">
                {EXPORT_PRESETS.map((p, i) => (
                  <label
                    key={p.label}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <input
                      type="radio"
                      name="preset"
                      checked={presetIdx === i}
                      onChange={() => setPresetIdx(i)}
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {p.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Filename
              </div>
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>

            {missingMedia.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                Re-link these files in the Media Bin before exporting:
                <ul className="mt-1 list-disc pl-5">
                  {missingMedia.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void onExport()}
                disabled={missingMedia.length > 0}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export
              </button>
            </div>
          </div>
        )}

        {state.kind === 'running' && (
          <div className="space-y-3">
            <PhaseLabel progress={state.progress} />
            <ProgressBar progress={state.progress} />
            <div className="flex justify-end">
              <button
                onClick={onCancel}
                className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state.kind === 'done' && (
          <div className="space-y-3">
            <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              ✓ Export complete · {(state.blob.size / 1_000_000).toFixed(1)} MB
              {state.delivery.kind === 'shared' && ' · opened share sheet'}
              {state.delivery.kind === 'saved' && ' · saved'}
              {state.delivery.kind === 'downloaded' && ' · downloaded'}
              {state.delivery.kind === 'cancelled' && ' · delivery cancelled'}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => void onShareAgain()}
                className="rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Share / save again
              </button>
              <button
                onClick={onClose}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="space-y-3">
            <div className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {state.message}
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PhaseLabel({ progress }: { progress: ExportProgress }) {
  const label =
    progress.phase === 'preparing'
      ? 'Preparing…'
      : progress.phase === 'encoding-video'
        ? `Encoding video · ${progress.framesDone ?? 0} / ${progress.framesTotal ?? 0} frames`
        : progress.phase === 'encoding-audio'
          ? 'Encoding audio…'
          : progress.phase === 'muxing'
            ? 'Muxing MP4…'
            : progress.phase === 'done'
              ? 'Done'
              : 'Error'
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300">{label}</div>
  )
}

function ProgressBar({ progress }: { progress: ExportProgress }) {
  const pct =
    progress.phase === 'encoding-video' &&
    progress.framesTotal &&
    progress.framesDone !== undefined
      ? progress.framesDone / progress.framesTotal
      : progress.phase === 'muxing' || progress.phase === 'encoding-audio'
        ? 0.95
        : progress.phase === 'done'
          ? 1
          : 0.1
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <div
        className="h-full bg-blue-500 transition-all"
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  )
}
