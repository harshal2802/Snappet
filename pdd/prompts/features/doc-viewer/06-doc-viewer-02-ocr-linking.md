# Prompt: Document Viewer — Part 2: OCR + Text↔Document Linking

**File**: pdd/prompts/features/doc-viewer/06-doc-viewer-02-ocr-linking.md
**Created**: 2026-03-31
**Project type**: Frontend / Web app
**Chain**: 2 of 2 — depends on 06-doc-viewer-01-setup.md being complete
**Depends on**: pdd/prompts/features/doc-viewer/06-doc-viewer-01-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This extends the Document Viewer mini-app (`/doc-viewer`) built in Part 1 with:
1. OCR text extraction using `tesseract.js` (browser WASM — no backend needed)
2. A text panel showing extracted text with word-level bounding boxes
3. Bidirectional linking: click a word in the text panel → highlight + scroll to it in the PDF/image viewer

**Stack**: React 18, TypeScript (strict), Tailwind CSS, Vite.

**Existing files** (from Part 1):
- `src/frontend/apps/doc-viewer/index.tsx` — upload UI + state management
- `src/frontend/apps/doc-viewer/PdfViewerPane.tsx` — full pdf.js viewer
- `src/frontend/apps/doc-viewer/ImageViewerPane.tsx` — image display with zoom

## Architecture

```
index.tsx
├── upload state: file (Uint8Array | dataURL), fileType, fileName
├── OCR state: ocrPages (OcrPage[]), ocrStatus, activeWordId
└── layout: two-panel split
    ├── LEFT: PdfViewerPane | ImageViewerPane (with highlight overlay)
    └── RIGHT: TextPanel (extracted text, clickable words)
```

## Data types

```ts
// src/frontend/apps/doc-viewer/types.ts

export interface BoundingBox {
  x: number       // pixels from left of page
  y: number       // pixels from top of page
  width: number
  height: number
  pageIndex: number  // 0-indexed
}

export interface OcrWord {
  id: string           // `p${pageIndex}-w${wordIndex}`
  text: string
  confidence: number   // 0–100
  bbox: BoundingBox
}

export interface OcrPage {
  pageIndex: number    // 0-indexed
  width: number        // page width in pixels at OCR resolution
  height: number       // page height in pixels at OCR resolution
  words: OcrWord[]
}
```

## Dependencies to install

```bash
npm install tesseract.js
```

## Task

Extend the Document Viewer with OCR extraction and bidirectional text↔document linking.

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/apps/doc-viewer/types.ts`

The types defined above. No additional types needed.

### 2. `src/frontend/apps/doc-viewer/ocr.ts`

Pure async functions, no React. Dynamically imports `tesseract.js` inside the function body so it is never in the main bundle.

```ts
// Run OCR on a single image (data URL or ImageData)
// Returns OcrPage with word-level bounding boxes
export async function runOcrOnImage(
  dataUrl: string,
  pageIndex: number,
  onProgress?: (pct: number) => void
): Promise<OcrPage>

// Run OCR on all pages of a PDF
// For each page: render to canvas via pdfjs, then OCR the canvas
// Returns OcrPage[] — one per PDF page
export async function runOcrOnPdf(
  pdfData: Uint8Array,
  onProgress?: (page: number, total: number, pct: number) => void
): Promise<OcrPage[]>
```

**Implementation details**:

`runOcrOnImage`:
- Dynamically import `{ createWorker }` from `'tesseract.js'`
- `createWorker('eng')` — initializes Tesseract WASM
- `worker.recognize(dataUrl)` → get `data.words`
- Map each word to `OcrWord`: use `word.bbox` (already in pixels: `x0, y0, x1, y1`) → convert to `{ x: x0, y: y0, width: x1-x0, height: y1-y0 }`
- `word.confidence` is already 0–100
- Generate `id`: `p${pageIndex}-w${wordIndex}`
- Get page dimensions from `data.imageSize` (or from a canvas if unavailable)
- `worker.terminate()` when done
- Call `onProgress` with Tesseract's internal progress (0–100)

`runOcrOnPdf`:
- Dynamically import `{ getDocument }` from `'pdfjs-dist'`
- Set `workerSrc` to `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`
- For each page (1-indexed in pdfjs):
  1. `page.getViewport({ scale: 2 })` — scale 2 gives good OCR resolution
  2. Create an `OffscreenCanvas` (or regular canvas) matching viewport size
  3. `page.render({ canvasContext, viewport })` → await completion
  4. Convert canvas to data URL: `canvas.toDataURL('image/png')`
  5. Call `runOcrOnImage(dataUrl, pageIndex, ...)` for that page
  6. Call `onProgress(pageNum, totalPages, pct)`
- Return all `OcrPage[]`

### 3. `src/frontend/apps/doc-viewer/TextPanel.tsx`

Props:
```ts
interface TextPanelProps {
  pages: OcrPage[]
  activeWordId: string | null
  onWordClick: (word: OcrWord) => void
  status: 'idle' | 'running' | 'done' | 'error'
  progress: string   // human-readable: "Extracting page 2 of 5…" or "75%"
  errorMessage: string | null
}
```

Layout (right panel, full height, scrollable):

**Header row**:
- "Extracted Text" title
- OCR status badge: idle=gray "Not started", running=blue spinner "Extracting…", done=green "Done", error=red "Error"

**Progress bar** (only when `status === 'running'`):
- Full-width thin bar with animated fill

**Content**:
- When `status === 'idle'`: placeholder "Run OCR to extract text" message with a button "Extract Text" (calls a prop `onStartOcr`)
- When `status === 'running'`: show progress text + skeleton lines
- When `status === 'error'`: error message
- When `status === 'done'`: render pages in order

**Per-page section** (when done):
- Small page label: "Page 1", "Page 2", etc.
- Words rendered as inline `<span>` elements with a space between each
- Each word span:
  - `data-word-id={word.id}`
  - Click → `onWordClick(word)`
  - Active (matches `activeWordId`): `bg-yellow-200 dark:bg-yellow-700 rounded`
  - Low confidence (< 60): `opacity-50` + `cursor-help` + `title="Low confidence"`
  - Hover: `bg-blue-100 dark:bg-blue-900/40 rounded cursor-pointer`
  - Transition on background change

**Auto-scroll**: when `activeWordId` changes, scroll the active word span into view using `scrollIntoView({ behavior: 'smooth', block: 'center' })`.

Add props:
```ts
onStartOcr: () => void
```

### 4. `src/frontend/apps/doc-viewer/HighlightOverlay.tsx`

A transparent overlay div positioned absolutely over the document viewer. Renders highlight boxes for the active word.

Props:
```ts
interface HighlightOverlayProps {
  activeWord: OcrWord | null
  pageWidth: number    // rendered page width in px (from viewer)
  pageHeight: number   // rendered page height in px
  ocrPageWidth: number  // width used during OCR (for coordinate scaling)
  ocrPageHeight: number
}
```

Renders a single `<div>` absolutely positioned, styled as a yellow semi-transparent rectangle:
- `position: absolute`
- `left`, `top`, `width`, `height` computed by scaling OCR coords to rendered size:
  ```
  scaleX = pageWidth / ocrPageWidth
  scaleY = pageHeight / ocrPageHeight
  left = activeWord.bbox.x * scaleX
  top = activeWord.bbox.y * scaleY
  width = activeWord.bbox.width * scaleX
  height = activeWord.bbox.height * scaleY
  ```
- Style: `bg-yellow-300/50 dark:bg-yellow-500/40 border border-yellow-400 rounded-sm pointer-events-none`
- Animate in with a short fade (`transition-opacity duration-150`)
- If `activeWord === null`, render nothing

### 5. `src/frontend/apps/doc-viewer/index.tsx` (updated)

Extend the existing component from Part 1:

**New state**:
```ts
const [ocrPages, setOcrPages] = useState<OcrPage[]>([])
const [ocrStatus, setOcrStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
const [ocrProgress, setOcrProgress] = useState('')
const [ocrError, setOcrError] = useState<string | null>(null)
const [activeWordId, setActiveWordId] = useState<string | null>(null)
```

**`handleStartOcr` function**:
```ts
async function handleStartOcr() {
  setOcrStatus('running')
  setOcrError(null)
  try {
    let pages: OcrPage[]
    if (fileType === 'pdf') {
      pages = await runOcrOnPdf(file as Uint8Array, (page, total, pct) => {
        setOcrProgress(`Extracting page ${page} of ${total} (${Math.round(pct)}%)`)
      })
    } else {
      pages = [await runOcrOnImage(file as string, 0, (pct) => {
        setOcrProgress(`${Math.round(pct)}%`)
      })]
    }
    setOcrPages(pages)
    setOcrStatus('done')
  } catch (e) {
    setOcrStatus('error')
    setOcrError(e instanceof Error ? e.message : 'OCR failed')
  }
}
```

**`handleWordClick` function**:
```ts
function handleWordClick(word: OcrWord) {
  setActiveWordId(word.id)
  // For PDF: use @react-pdf-viewer's jumpToPage via a ref on PdfViewerPane
  // For image: the overlay handles display directly
  // The viewer pane scrolls to the correct page
}
```

**Layout when file is loaded** — two-panel horizontal split:
```
┌─────────────────────────────┬──────────────────┐
│                             │   Text Panel     │
│   PDF Viewer / Image        │   (scrollable)   │
│   (with highlight overlay)  │   right: 320px   │
│   flex-1                    │   fixed width    │
└─────────────────────────────┴──────────────────┘
```

- Left panel: `flex-1 relative overflow-hidden` — contains the viewer + `HighlightOverlay`
- Right panel: `w-80 border-l border-gray-200 dark:border-gray-700 overflow-y-auto`
- Pass `activeWordId` and `onWordClick` to both panels

**Extend `PdfViewerPane`** — add a `onJumpToPage` callback prop so `handleWordClick` can tell the viewer to scroll to the word's page:
```ts
interface PdfViewerPaneProps {
  fileData: Uint8Array
  fileName: string
  activeWord: OcrWord | null
  ocrPages: OcrPage[]
  onJumpToPage?: (pageIndex: number) => void
}
```

Use `@react-pdf-viewer`'s `pageNavigationPlugin` to expose `jumpToPage`:
```ts
const pageNavPlugin = pageNavigationPlugin()
// pass jumpToPage via a ref or callback up to the parent
```

**Reset** — also clears `ocrPages`, `ocrStatus`, `ocrProgress`, `ocrError`, `activeWordId`.

## Constraints

- `tesseract.js` must be dynamically imported inside `ocr.ts` function bodies — never statically imported at the top of any file
- `pdfjs-dist` in `ocr.ts` must also be dynamically imported (separate from the viewer's pdfjs instance)
- `OffscreenCanvas` may not be available in all browsers — fall back to `document.createElement('canvas')` if `typeof OffscreenCanvas === 'undefined'`
- OCR is CPU-intensive — do not block the UI; always use async/await and update progress state so the user sees feedback
- Coordinate scaling in `HighlightOverlay` must account for the difference between OCR resolution (scale 2) and current viewer zoom — use proportional scaling
- Low-confidence words (< 60) should be visually marked in the text panel but still clickable
- TypeScript strict — no `any`; import pdfjs types from `pdfjs-dist` where needed
- Dark mode on all custom UI elements
- The text panel must be independently scrollable from the viewer
- When `activeWordId` changes, auto-scroll the text panel to the active word span

## Future scope notes (do not implement — just structure for it)

The `OcrPage[]` data structure with word-level bounding boxes is designed to be passed directly to an LLM chat feature in a future prompt. The full document text can be derived as:
```ts
const fullText = ocrPages.map(p => p.words.map(w => w.text).join(' ')).join('\n\n')
```
And individual word positions can be used to highlight LLM-cited passages back in the document. Keep `OcrPage[]` in the top-level `index.tsx` state so it is accessible to any future chat panel added alongside the viewer.
