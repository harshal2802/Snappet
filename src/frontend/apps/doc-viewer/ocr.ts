import type { OcrPage, OcrWord } from './types'
import type { RecognizeResult, Block, Paragraph, Line, Word } from 'tesseract.js'

const PDFJS_WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
const OCR_SCALE = 2 // render PDF pages at 2x for better OCR quality

/**
 * Run OCR on a single image (data URL).
 * Dynamically imports tesseract.js — never in the main bundle.
 */
export async function runOcrOnImage(
  dataUrl: string,
  pageIndex: number,
  onProgress?: (pct: number) => void
): Promise<OcrPage> {
  // Dynamic import — only loads when called
  const { createWorker } = await import('tesseract.js')

  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  const result: RecognizeResult = await worker.recognize(dataUrl)
  await worker.terminate()

  const { data } = result

  // Get page dimensions from image
  const img = await loadImage(dataUrl)
  const pageWidth = img.naturalWidth
  const pageHeight = img.naturalHeight

  // In tesseract.js v7, words live inside blocks > paragraphs > lines > words
  const allWords = (data.blocks ?? []).flatMap((block: Block) =>
    block.paragraphs.flatMap((para: Paragraph) =>
      para.lines.flatMap((line: Line) => line.words)
    )
  )

  const words: OcrWord[] = allWords.map((word: Word, i: number) => ({
    id: `p${pageIndex}-w${i}`,
    text: word.text,
    confidence: word.confidence,
    bbox: {
      x: word.bbox.x0,
      y: word.bbox.y0,
      width: word.bbox.x1 - word.bbox.x0,
      height: word.bbox.y1 - word.bbox.y0,
      pageIndex,
    },
  }))

  return { pageIndex, width: pageWidth, height: pageHeight, words }
}

/**
 * Run OCR on all pages of a PDF.
 * Renders each page to a canvas via pdfjs, then OCRs the canvas image.
 */
export async function runOcrOnPdf(
  pdfData: Uint8Array,
  onProgress?: (page: number, total: number, pct: number) => void
): Promise<OcrPage[]> {
  // Dynamic import of pdfjs — separate from the viewer's instance
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
  const totalPages = pdf.numPages
  const results: OcrPage[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageIndex = pageNum - 1
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: OCR_SCALE })

    // Create canvas — fall back to regular canvas if OffscreenCanvas unavailable
    let canvas: HTMLCanvasElement | OffscreenCanvas
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(viewport.width, viewport.height)
      ctx = canvas.getContext('2d')
    } else {
      const el = document.createElement('canvas')
      el.width = viewport.width
      el.height = viewport.height
      canvas = el
      ctx = el.getContext('2d')
    }

    if (!ctx) throw new Error(`Failed to get 2D context for page ${pageNum}`)

    await page.render({
      canvasContext: ctx as CanvasRenderingContext2D,
      viewport,
    }).promise

    // Convert canvas to data URL
    let dataUrl: string
    if (canvas instanceof OffscreenCanvas) {
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      dataUrl = await blobToDataUrl(blob)
    } else {
      dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png')
    }

    const ocrPage = await runOcrOnImage(dataUrl, pageIndex, (pct) => {
      onProgress?.(pageNum, totalPages, pct)
    })

    // Override dimensions to match the canvas (OCR_SCALE applied)
    results.push({
      ...ocrPage,
      width: viewport.width,
      height: viewport.height,
    })

    onProgress?.(pageNum, totalPages, 100)
  }

  return results
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to convert blob'))
    reader.readAsDataURL(blob)
  })
}
