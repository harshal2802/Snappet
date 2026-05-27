import { useState } from 'react'
import type {
  OcrPage,
  OcrWord,
  OcrStatus,
  Annotation,
  AnnotationColor,
  PanelTab,
} from './types'
import OcrTextView from './OcrTextView'
import AnnotationsListView from './AnnotationsListView'

interface TextPanelProps {
  pages: OcrPage[]
  annotations: Annotation[]
  annotationByWordId: Map<string, Annotation>
  allWordsOrdered: OcrWord[]
  selectedWordIds: string[]
  selectedWords: OcrWord[]
  onSetSelection: (wordIds: string[]) => void
  onStartOcr: () => void
  onApplyColorToSelection: (color: AnnotationColor) => void
  onRemoveAnnotation: (annotationId: string) => void
  onUpdateNote: (annotationId: string, note: string) => void
  onExport: () => void
  canDownloadAnnotatedPdf: boolean
  isExportingPdf: boolean
  onDownloadAnnotatedPdf: () => void
  status: OcrStatus
  progress: string
  errorMessage: string | null
}

const STATUS_BADGE: Record<OcrStatus, { label: string; className: string }> = {
  idle: { label: 'Not started', className: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  running: { label: 'Extracting…', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
  done: { label: 'Done', className: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' },
  error: { label: 'Error', className: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
}

const TAB_BTN_BASE =
  'flex-1 px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded'
const TAB_BTN_ACTIVE = 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
const TAB_BTN_INACTIVE = 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

export default function TextPanel({
  pages,
  annotations,
  annotationByWordId,
  allWordsOrdered,
  selectedWordIds,
  selectedWords,
  onSetSelection,
  onStartOcr,
  onApplyColorToSelection,
  onRemoveAnnotation,
  onUpdateNote,
  onExport,
  canDownloadAnnotatedPdf,
  isExportingPdf,
  onDownloadAnnotatedPdf,
  status,
  progress,
  errorMessage,
}: TextPanelProps) {
  const [tab, setTab] = useState<PanelTab>('text')
  const badge = STATUS_BADGE[status]
  const hasResults = status === 'done' && pages.length > 0

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Extracted Text
          </span>
          <div className="flex items-center gap-1.5">
            {hasResults && canDownloadAnnotatedPdf && annotations.length > 0 && (
              <button
                onClick={onDownloadAnnotatedPdf}
                disabled={isExportingPdf}
                title="Download a copy of the PDF with annotations baked in"
                className="px-2 py-0.5 rounded text-xs text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {isExportingPdf ? '…' : '↓ PDF'}
              </button>
            )}
            {hasResults && (
              <button
                onClick={onExport}
                title="Export text and annotations as JSON"
                className="px-2 py-0.5 rounded text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                ↓ JSON
              </button>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.className}`}>
              {status === 'running' && (
                <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {badge.label}
            </span>
          </div>
        </div>

        {hasResults && (
          <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
            <button
              onClick={() => setTab('text')}
              aria-pressed={tab === 'text'}
              className={`${TAB_BTN_BASE} ${tab === 'text' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
            >
              Text
            </button>
            <button
              onClick={() => setTab('annotations')}
              aria-pressed={tab === 'annotations'}
              className={`${TAB_BTN_BASE} ${tab === 'annotations' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
            >
              Annotations
              {annotations.length > 0 && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">({annotations.length})</span>
              )}
            </button>
          </div>
        )}
      </div>

      {status === 'running' && (
        <div className="h-1 bg-gray-100 dark:bg-gray-700 shrink-0">
          <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}

      {status === 'idle' && (
        <div className="flex-1 overflow-y-auto p-3">
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
        </div>
      )}

      {status === 'running' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
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

      {status === 'error' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          <button
            onClick={onStartOcr}
            className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Retry
          </button>
        </div>
      )}

      {hasResults && tab === 'text' && (
        <OcrTextView
          pages={pages}
          allWordsOrdered={allWordsOrdered}
          selectedWordIds={selectedWordIds}
          selectedWords={selectedWords}
          annotationByWordId={annotationByWordId}
          onSetSelection={onSetSelection}
          onApplyColorToSelection={onApplyColorToSelection}
          onUpdateNote={onUpdateNote}
        />
      )}

      {hasResults && tab === 'annotations' && (
        <AnnotationsListView
          annotations={annotations}
          selectedWordIds={selectedWordIds}
          onJump={(ann) => onSetSelection(ann.wordIds)}
          onRemove={onRemoveAnnotation}
          onUpdateNote={onUpdateNote}
        />
      )}
    </div>
  )
}
