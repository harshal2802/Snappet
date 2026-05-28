import { useCallback, useRef, useState } from 'react'
import { useEditorStore } from '../state/editorStore'

export default function Dropzone() {
  const ingestFiles = useEditorStore((s) => s.ingestFiles)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const onFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return
      const arr = Array.from(files).filter(
        (f) => f.type.startsWith('video/') || f.type.startsWith('image/'),
      )
      if (arr.length === 0) return
      void ingestFiles(arr)
    },
    [ingestFiles],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ' +
        (dragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
          : 'border-gray-300 bg-white hover:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-500')
      }
    >
      <div className="text-3xl" aria-hidden>
        🎞️
      </div>
      <div className="font-medium text-gray-900 dark:text-gray-100">
        Drop videos or photos here
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        or click to pick from your device
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  )
}
