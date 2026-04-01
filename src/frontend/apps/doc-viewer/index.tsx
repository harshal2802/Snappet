import { useState, useRef, useCallback, useEffect } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import type { FileType, OcrWord, OcrPage, OcrStatus } from './types'
import PdfViewerPane, { type PdfViewerPaneHandle } from './PdfViewerPane'
import ImageViewerPane from './ImageViewerPane'
import TextPanel from './TextPanel'
import HighlightOverlay from './HighlightOverlay'
import { runOcrOnImage, runOcrOnPdf } from './ocr'

const ACCEPTED_EXT = '.pdf,.png,.jpg,.jpeg'

function getFileType(mime: string): FileType | null {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png' || mime === 'image/jpeg') return 'image'
  return null
}

export default function DocViewer() {
  // Persisted metadata
  const [fileName, setFileName] = useLocalStorage<string | null>('snappet:doc-viewer:fileName', null)
  const [fileType, setFileType] = useLocalStorage<FileType | null>('snappet:doc-viewer:fileType', null)

  // Non-persisted runtime state
  const [fileData, setFileData] = useState<Uint8Array | string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // OCR state
  const [ocrPages, setOcrPages] = useState<OcrPage[]>([])
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [ocrProgress, setOcrProgress] = useState('')
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [activeWordId, setActiveWordId] = useState<string | null>(null)

  // Viewer container size (for HighlightOverlay coordinate scaling)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const inputRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<PdfViewerPaneHandle>(null)
  const viewerContainerRef = useRef<HTMLDivElement>(null)

  // Measure viewer container for overlay scaling
  useEffect(() => {
    const el = viewerContainerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fileData])

  async function processFile(file: File) {
    const type = getFileType(file.type)
    if (!type) {
      setError(`Unsupported file type "${file.type}". Please upload a PDF, PNG, or JPG.`)
      return
    }
    setIsLoading(true)
    setError(null)
    // Reset OCR on new file
    setOcrPages([])
    setOcrStatus('idle')
    setOcrProgress('')
    setOcrError(null)
    setActiveWordId(null)

    try {
      if (type === 'pdf') {
        const buffer = await file.arrayBuffer()
        setFileData(new Uint8Array(buffer))
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
        setFileData(dataUrl)
      }
      setFileName(file.name)
      setFileType(type)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file')
    } finally {
      setIsLoading(false)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  async function handleStartOcr() {
    if (!fileData || !fileType) return
    setOcrStatus('running')
    setOcrError(null)
    setOcrPages([])
    setActiveWordId(null)

    try {
      let pages: OcrPage[]
      if (fileType === 'pdf') {
        pages = await runOcrOnPdf(fileData as Uint8Array, (page, total, pct) => {
          setOcrProgress(`Extracting page ${page} of ${total} (${Math.round(pct)}%)`)
        })
      } else {
        pages = [
          await runOcrOnImage(fileData as string, 0, (pct) => {
            setOcrProgress(`${Math.round(pct)}%`)
          }),
        ]
      }
      setOcrPages(pages)
      setOcrStatus('done')
    } catch (e) {
      setOcrStatus('error')
      setOcrError(e instanceof Error ? e.message : 'OCR failed')
    }
  }

  function handleWordClick(word: OcrWord) {
    setActiveWordId(word.id)
    // Jump to the page containing this word in the PDF viewer
    if (fileType === 'pdf' && pdfRef.current) {
      pdfRef.current.jumpToPage(word.bbox.pageIndex)
    }
  }

  const handleReset = useCallback(() => {
    setFileData(null)
    setFileName(null)
    setFileType(null)
    setError(null)
    setIsLoading(false)
    setOcrPages([])
    setOcrStatus('idle')
    setOcrProgress('')
    setOcrError(null)
    setActiveWordId(null)
  }, [setFileName, setFileType])

  const activeWord = ocrPages
    .flatMap((p) => p.words)
    .find((w) => w.id === activeWordId) ?? null

  // ── VIEWER ──────────────────────────────────────────────────────────────────
  if (fileData !== null && fileType !== null && fileName !== null) {
    return (
      <div className="fixed inset-0 top-[57px] flex flex-col bg-white dark:bg-gray-900">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
          <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Document Viewer
          </h1>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: viewer + highlight overlay */}
          <div ref={viewerContainerRef} className="flex-1 relative overflow-hidden">
            {fileType === 'pdf' ? (
              <PdfViewerPane
                ref={pdfRef}
                fileData={fileData as Uint8Array}
                fileName={fileName}
                activeWord={activeWord}
              />
            ) : (
              <ImageViewerPane
                fileData={fileData as string}
                fileName={fileName}
              />
            )}
            <HighlightOverlay
              activeWord={activeWord}
              ocrPages={ocrPages}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          </div>

          {/* Right: text panel — fixed 320px */}
          <div className="w-80 shrink-0 overflow-hidden flex flex-col">
            <TextPanel
              pages={ocrPages}
              activeWordId={activeWordId}
              onWordClick={handleWordClick}
              onStartOcr={handleStartOcr}
              status={ocrStatus}
              progress={ocrProgress}
              errorMessage={ocrError}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── UPLOAD UI ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Document Viewer
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View PDFs and images with full-featured viewer and OCR text extraction.
          </p>
        </div>
      </div>

      {/* Re-upload hint from previous session */}
      {fileName && !fileData && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-300">
          <span>📄</span>
          <span>Re-upload <strong>{fileName}</strong> to restore your session.</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3 p-12
          rounded-2xl border-2 border-dashed cursor-pointer transition-colors duration-150
          ${isDragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }
        `}
      >
        <span className="text-5xl select-none">{isDragging ? '📂' : '📁'}</span>
        <div className="text-center">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {isDragging ? 'Drop to open' : 'Drop a PDF or image here'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            or <span className="text-blue-600 dark:text-blue-400">click to browse</span>
          </p>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Supported: PDF, PNG, JPG</p>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-gray-800/80">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT}
        onChange={handleFileInput}
        className="hidden"
        aria-label="Upload a document"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400 px-1">{error}</p>}

      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
        {[
          '📑 Thumbnails & bookmarks',
          '🔍 Full-text search',
          '🔎 Zoom & fit options',
          '↕️ Scroll modes',
          '🔄 Rotate pages',
          '🖨️ Print & download',
          '⛶ Full-screen mode',
          '🤖 OCR text extraction',
        ].map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
