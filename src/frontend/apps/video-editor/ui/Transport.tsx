import { useEffect } from 'react'
import { useEditorStore } from '../state/editorStore'
import { formatTimecode, totalDurationSec } from '../state/selectors'

export default function Transport() {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const playhead = useEditorStore((s) => s.playhead)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const play = useEditorStore((s) => s.play)
  const pause = useEditorStore((s) => s.pause)
  const split = useEditorStore((s) => s.splitClipAtPlayhead)
  const del = useEditorStore((s) => s.deleteSelection)
  const project = useEditorStore((s) => s.project)
  const total = totalDurationSec(project)

  // Keyboard shortcuts: space=play/pause, s=split, backspace/delete=delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement
      if (
        tgt instanceof HTMLInputElement ||
        tgt instanceof HTMLTextAreaElement ||
        tgt.isContentEditable
      ) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (isPlaying) pause()
        else play()
      } else if (e.key === 's' || e.key === 'S') {
        split()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        del()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, play, pause, split, del])

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPlayhead(0)}
          className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Skip to start"
          aria-label="Skip to start"
        >
          ⏮
        </button>
        <button
          onClick={() => (isPlaying ? pause() : play())}
          className="rounded bg-blue-600 px-3 py-1.5 text-white shadow-sm hover:bg-blue-700"
          title="Play / Pause (Space)"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setPlayhead(total)}
          className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Skip to end"
          aria-label="Skip to end"
        >
          ⏭
        </button>
      </div>
      <div className="font-mono text-sm tabular-nums text-gray-700 dark:text-gray-300">
        {formatTimecode(playhead)} / {formatTimecode(total)}
      </div>
    </div>
  )
}
