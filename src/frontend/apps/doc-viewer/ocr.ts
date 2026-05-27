import type { OcrPage, OcrWord, OcrBlock, OcrParagraph, OcrLine } from './types'
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

  // tesseract.js v7's recognize() defaults to `{ text: true }` only, which
  // leaves `data.blocks` null. Opt into the block hierarchy so we can pull
  // word-level bounding boxes for the click-to-highlight feature.
  const result: RecognizeResult = await worker.recognize(dataUrl, {}, { blocks: true, text: true })
  await worker.terminate()

  const { data } = result

  // Get page dimensions from image
  const img = await loadImage(dataUrl)
  const pageWidth = img.naturalWidth
  const pageHeight = img.naturalHeight

  // Walk the block > paragraph > line > word hierarchy. We share OcrWord
  // references between the flat `words` list and the structured `blocks` tree
  // so selection and rendering both see the same identities.
  const flatWords: OcrWord[] = []

  function toOcrWord(raw: Word): OcrWord {
    const w: OcrWord = {
      id: `p${pageIndex}-w${flatWords.length}`,
      text: raw.text,
      confidence: raw.confidence,
      bbox: {
        x: raw.bbox.x0,
        y: raw.bbox.y0,
        width: raw.bbox.x1 - raw.bbox.x0,
        height: raw.bbox.y1 - raw.bbox.y0,
        pageIndex,
      },
    }
    flatWords.push(w)
    return w
  }

  const blocks: OcrBlock[] = (data.blocks ?? []).flatMap((block: Block) => {
    const paragraphs: OcrParagraph[] = block.paragraphs.flatMap((para: Paragraph) => {
      const lines: OcrLine[] = para.lines.flatMap((line: Line) => {
        const words = line.words.filter((w) => (w.text ?? '').trim() !== '').map(toOcrWord)
        return words.length > 0 ? [{ words }] : []
      })
      return lines.length > 0 ? [{ lines }] : []
    })
    return paragraphs.length > 0 ? [{ paragraphs }] : []
  })

  return { pageIndex, width: pageWidth, height: pageHeight, words: flatWords, blocks }
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

  // Clone the buffer: pdf.js transfers `data` to its worker thread (detaching
  // the ArrayBuffer), and the same bytes are also held by the react-pdf-viewer
  // instance. Without a copy, whichever consumer runs second sees a detached
  // buffer and OCR fails with "Cannot perform Construct on detached ArrayBuffer".
  const pdf = await pdfjsLib.getDocument({ data: pdfData.slice() }).promise
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
