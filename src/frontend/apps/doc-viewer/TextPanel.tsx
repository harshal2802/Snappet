import { useEffect, useRef } from 'react'
import type { OcrPage, OcrWord, OcrStatus } from './types'

interface TextPanelProps {
  pages: OcrPage[]
  activeWordId: string | null
  onWordClick: (word: OcrWord) => void
  onStartOcr: () => void
  status: OcrStatus
  progress: string
  errorMessage: string | null
}

const statusBadge: Record<OcrStatus, { label: string; className: string }> = {
  idle: { label: 'Not started', className: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  running: { label: 'Extracting…', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
  done: { label: 'Done', className: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' },
  error: { label: 'Error', className: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
}

export default function TextPanel({
  pages,
  activeWordId,
  onWordClick,
  onStartOcr,
  status,
  progress,
  errorMessage,
}: TextPanelProps) {
  const activeRef = useRef<HTMLSpanElement | null>(null)

  // Auto-scroll active word into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeWordId])

  const badge = statusBadge[status]

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Extracted Text
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.className}`}>
          {status === 'running' && (
            <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {badge.label}
        </span>
      </div>

      {/* Progress bar */}
      {status === 'running' && (
        <div className="h-1 bg-gray-100 dark:bg-gray-700 shrink-0">
          <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Idle — prompt to start */}
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <span className="text-3xl">🤖</span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Run OCR to extract text from this document.
            </p>
            <button
              onClick={onStartOcr}
              className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Extract Text
            </button>
          </div>
        )}

        {/* Running — progress + skeletons */}
        {status === 'running' && (
          <div className="space-y-3">
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center">{progress}</p>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
                style={{ width: `${60 + (i % 3) * 15}%` }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            <button
              onClick={onStartOcr}
              className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Retry
            </button>
          </div>
        )}

        {/* Done — render pages */}
        {status === 'done' && pages.map((page) => (
          <div key={page.pageIndex} className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Page {page.pageIndex + 1}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {page.words.map((word) => {
                const isActive = word.id === activeWordId
                const isLowConf = word.confidence < 60
                return (
                  <span key={word.id} ref={isActive ? activeRef : null}>
                    <span
                      data-word-id={word.id}
                      onClick={() => onWordClick(word)}
                      title={isLowConf ? `Low confidence (${Math.round(word.confidence)}%)` : undefined}
                      className={`
                        cursor-pointer rounded px-0.5 transition-colors duration-100
                        ${isActive
                          ? 'bg-yellow-200 dark:bg-yellow-700'
                          : 'hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        }
                        ${isLowConf ? 'opacity-50 cursor-help' : ''}
                      `}
                    >
                      {word.text}
                    </span>
                    {' '}
                  </span>
                )
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
