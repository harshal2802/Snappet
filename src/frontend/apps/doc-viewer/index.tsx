import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import type {
  FileType,
  OcrPage,
  OcrStatus,
  Annotation,
  AnnotationColor,
  LegacyAnnotation,
} from './types'
import PdfViewerPane, { type PdfViewerPaneHandle } from './PdfViewerPane'
import ImageViewerPane from './ImageViewerPane'
import TextPanel from './TextPanel'
import HighlightOverlay from './HighlightOverlay'
import { runOcrOnImage, runOcrOnPdf } from './ocr'
import { embedAnnotationsInPdf } from './pdfAnnotator'

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

// Convert legacy single-word annotations (pre-multi-select) into the
// current multi-word shape. Safe to call on already-migrated entries.
function migrateAnnotation(raw: Annotation | LegacyAnnotation): Annotation {
  if ('wordIds' in raw && Array.isArray((raw as Annotation).wordIds)) {
    return raw as Annotation
  }
  const legacy = raw as LegacyAnnotation
  return {
    id: legacy.id,
    wordIds: [legacy.wordId],
    pageIndex: legacy.pageIndex,
    color: legacy.color,
    note: legacy.note,
    createdAt: legacy.createdAt,
    text: legacy.text,
    bboxes: [legacy.bbox],
  }
}

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
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([])

  // Persisted annotations, keyed by fileName so re-uploading restores them.
  // Read as a wider type so we can migrate legacy single-word entries.
  const [annotationsByFile, setAnnotationsByFile] = useLocalStorage<
    Record<string, Array<Annotation | LegacyAnnotation>>
  >('snappet:doc-viewer:annotations', {})

  const annotations: Annotation[] = useMemo(() => {
    if (!fileName) return []
    return (annotationsByFile[fileName] ?? []).map(migrateAnnotation)
  }, [annotationsByFile, fileName])

  // Reverse lookup: each wordId → its annotation (no overlap allowed, so 1:1).
  const annotationByWordId = useMemo(() => {
    const map = new Map<string, Annotation>()
    for (const a of annotations) {
      for (const wid of a.wordIds) map.set(wid, a)
    }
    return map
  }, [annotations])

  const allWordsOrdered = useMemo(
    () => ocrPages.flatMap((p) => p.words),
    [ocrPages],
  )

  const selectedWords = useMemo(() => {
    const set = new Set(selectedWordIds)
    return allWordsOrdered.filter((w) => set.has(w.id))
  }, [allWordsOrdered, selectedWordIds])

  const inputRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<PdfViewerPaneHandle>(null)

  // Resizable text panel — persist width per user, clamp to a sane range.
  const [panelWidth, setPanelWidth] = useLocalStorage<number>(
    'snappet:doc-viewer:panelWidth',
    320,
  )
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return
    function onMove(e: MouseEvent) {
      const next = window.innerWidth - e.clientX
      setPanelWidth(Math.max(240, Math.min(800, next)))
    }
    function onUp() {
      setIsResizing(false)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isResizing, setPanelWidth])

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
    setSelectedWordIds([])

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
    setSelectedWordIds([])

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

  // ── Selection handlers ───────────────────────────────────────────────────────

  function handleSetSelection(wordIds: string[]) {
    // Dedupe but preserve first-seen order. Document-order normalization happens
    // when we promote a selection into an annotation.
    const deduped: string[] = []
    const seen = new Set<string>()
    for (const id of wordIds) {
      if (!seen.has(id)) {
        seen.add(id)
        deduped.push(id)
      }
    }
    setSelectedWordIds(deduped)
    if (deduped.length === 0) return
    const first = allWordsOrdered.find((w) => w.id === deduped[0])
    if (first && fileType === 'pdf' && pdfRef.current) {
      pdfRef.current.jumpToPage(first.bbox.pageIndex)
    }
  }

  // ── Annotation handlers ──────────────────────────────────────────────────────

  function updateAnnotationsForCurrentFile(
    updater: (current: Annotation[]) => Annotation[],
  ) {
    if (!fileName) return
    setAnnotationsByFile((prev) => {
      const current = (prev[fileName] ?? []).map(migrateAnnotation)
      const next = updater(current)
      if (next.length === 0) {
        const { [fileName]: _omit, ...rest } = prev
        return rest
      }
      return { ...prev, [fileName]: next }
    })
  }

  function handleApplyColorToSelection(color: AnnotationColor) {
    if (selectedWords.length === 0) return
    const selectedSet = new Set(selectedWordIds)

    updateAnnotationsForCurrentFile((current) => {
      // Set-equality check: same size + every wordId in selection
      const exact = current.find(
        (a) =>
          a.wordIds.length === selectedSet.size &&
          a.wordIds.every((id) => selectedSet.has(id)),
      )
      if (exact && exact.color === color) {
        return current.filter((a) => a.id !== exact.id) // toggle off
      }
      if (exact) {
        return current.map((a) => (a.id === exact.id ? { ...a, color } : a))
      }
      // New annotation — drop any overlapping ones to keep word↔annotation 1:1
      const filtered = current.filter(
        (a) => !a.wordIds.some((id) => selectedSet.has(id)),
      )
      const orderedWords = selectedWords // already in document order
      const fresh: Annotation = {
        id: generateId(),
        wordIds: orderedWords.map((w) => w.id),
        pageIndex: orderedWords[0].bbox.pageIndex,
        color,
        note: '',
        createdAt: Date.now(),
        text: orderedWords.map((w) => w.text).join(' '),
        bboxes: orderedWords.map((w) => ({
          x: w.bbox.x,
          y: w.bbox.y,
          width: w.bbox.width,
          height: w.bbox.height,
        })),
      }
      return [...filtered, fresh]
    })
  }

  function handleRemoveAnnotation(annotationId: string) {
    updateAnnotationsForCurrentFile((current) =>
      current.filter((a) => a.id !== annotationId),
    )
  }

  function handleUpdateNote(annotationId: string, note: string) {
    updateAnnotationsForCurrentFile((current) =>
      current.map((a) => (a.id === annotationId ? { ...a, note } : a)),
    )
  }

  const [isExportingPdf, setIsExportingPdf] = useState(false)

  async function handleDownloadAnnotatedPdf() {
    if (!fileName || fileType !== 'pdf' || !fileData) return
    setIsExportingPdf(true)
    try {
      // Clone the source bytes — pdf.js's worker may have detached the
      // viewer's copy, and pdf-lib also takes ownership of what we pass.
      const sourceCopy = new Uint8Array(fileData as Uint8Array)
      const out = await embedAnnotationsInPdf(sourceCopy, annotations, ocrPages)
      // pdf-lib returns Uint8Array<ArrayBufferLike>; Blob's type wants
      // ArrayBuffer. Re-wrap so the underlying buffer is concrete.
      const blob = new Blob([new Uint8Array(out).buffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileName.replace(/\.pdf$/i, '')}-annotated.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to export annotated PDF:', e)
      alert(`Failed to export annotated PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsExportingPdf(false)
    }
  }

  function handleExport() {
    if (!fileName) return
    const payload = {
      fileName,
      fileType,
      exportedAt: new Date().toISOString(),
      pages: ocrPages.map((p) => ({
        pageIndex: p.pageIndex,
        text: p.words.map((w) => w.text).join(' '),
        wordCount: p.words.length,
      })),
      annotations: annotations.map((a) => ({
        id: a.id,
        pageIndex: a.pageIndex,
        text: a.text,
        color: a.color,
        note: a.note,
        createdAt: a.createdAt,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName.replace(/\.[^.]+$/, '')}-ocr-annotations.json`
    link.click()
    URL.revokeObjectURL(url)
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
    setSelectedWordIds([])
  }, [setFileName, setFileType])

  // ── VIEWER ──────────────────────────────────────────────────────────────────
  if (fileData !== null && fileType !== null && fileName !== null) {
    return (
      <div className="fixed inset-0 top-[57px] flex flex-col bg-white dark:bg-gray-900">
        {/* Mouse capture overlay during drag-resize. Keeps cursor consistent and
            prevents iframe content (PDF viewer) from stealing the move events. */}
        {isResizing && (
          <div className="fixed inset-0 z-[100] cursor-col-resize select-none" />
        )}
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
          <div className="flex-1 relative overflow-hidden">
            {fileType === 'pdf' ? (
              <PdfViewerPane
                ref={pdfRef}
                fileData={fileData as Uint8Array}
                fileName={fileName}
              />
            ) : (
              <ImageViewerPane
                fileData={fileData as string}
                fileName={fileName}
              />
            )}
            <HighlightOverlay
              selectedWords={selectedWords}
              annotations={annotations}
              ocrPages={ocrPages}
            />
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={() => setIsResizing(true)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize text panel"
            title="Drag to resize"
            className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors shrink-0"
          />

          {/* Right: text panel — resizable */}
          <div
            className="shrink-0 overflow-hidden flex flex-col"
            style={{ width: panelWidth }}
          >
            <TextPanel
              pages={ocrPages}
              annotations={annotations}
              annotationByWordId={annotationByWordId}
              allWordsOrdered={allWordsOrdered}
              selectedWordIds={selectedWordIds}
              selectedWords={selectedWords}
              onSetSelection={handleSetSelection}
              onStartOcr={handleStartOcr}
              onApplyColorToSelection={handleApplyColorToSelection}
              onRemoveAnnotation={handleRemoveAnnotation}
              onUpdateNote={handleUpdateNote}
              onExport={handleExport}
              canDownloadAnnotatedPdf={fileType === 'pdf'}
              isExportingPdf={isExportingPdf}
              onDownloadAnnotatedPdf={handleDownloadAnnotatedPdf}
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
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
          🔒 All OCR and processing happens in your browser. Your file never leaves your device.
        </p>

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
