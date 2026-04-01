import { useState } from 'react'

interface ImageViewerPaneProps {
  fileData: string   // data URL
  fileName: string
}

export default function ImageViewerPane({ fileData, fileName }: ImageViewerPaneProps) {
  const [zoom, setZoom] = useState(100)

  function zoomIn() { setZoom((z) => Math.min(300, z + 10)) }
  function zoomOut() { setZoom((z) => Math.max(50, z - 10)) }
  function resetZoom() { setZoom(100) }

  return (
    <div className="flex flex-col h-full">
      {/* File name + zoom bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">🖼️</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={zoomOut}
            disabled={zoom <= 50}
            aria-label="Zoom out"
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >−</button>
          <button
            onClick={resetZoom}
            className="px-2 h-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:border-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[3.5rem] text-center"
          >{zoom}%</button>
          <button
            onClick={zoomIn}
            disabled={zoom >= 300}
            aria-label="Zoom in"
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >+</button>
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <img
          src={fileData}
          alt={fileName}
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="max-w-full object-contain transition-transform duration-150 shadow-md rounded"
        />
      </div>
    </div>
  )
}
