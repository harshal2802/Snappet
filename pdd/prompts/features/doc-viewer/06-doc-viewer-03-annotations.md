# Prompt: Document Viewer — Part 3: Hierarchical OCR + Annotations + Export

**File**: pdd/prompts/features/doc-viewer/06-doc-viewer-03-annotations.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Chain**: 3 of 3 — depends on parts 1 and 2
**Depends on**:
- pdd/prompts/features/doc-viewer/06-doc-viewer-01-setup.md
- pdd/prompts/features/doc-viewer/06-doc-viewer-02-ocr-linking.md

## Context

Snappet is a hub of lightweight single-page web apps. This extends the Document Viewer (`/doc-viewer`) built in Parts 1 + 2 with:
1. **Hierarchical OCR** — preserve tesseract.js's `blocks → paragraphs → lines → words` tree instead of flattening to a word list
2. **Multi-color annotations** — highlight selected words with one of four colors plus an optional note
3. **Multi-word selection** — drag-to-select, shift+click range, ⌘/Ctrl+click toggle
4. **Annotations list view** — second tab in the side panel with sort, jump-to, edit, delete
5. **Export** — JSON dump of OCR + annotations, *and* a copy of the original PDF with the annotations baked in as native PDF Highlight annotations
6. **Resizable side panel** — drag handle between viewer and panel; width persists
7. **Privacy disclosure** — surface that OCR + everything runs in the browser; no upload

**Stack**: React 18, TypeScript (strict), Tailwind CSS, Vite. Existing deps: `tesseract.js`, `pdfjs-dist`, `@react-pdf-viewer/*`. Add `pdf-lib` for annotation embedding.

## Architecture

```
index.tsx
├── persisted state: fileName, fileType, panelWidth, annotationsByFile (keyed by fileName)
├── transient state: fileData, ocrPages, selectedWordIds, isResizing, isExportingPdf
├── derived: annotations (for current file), annotationByWordId (reverse lookup), selectedWords, allWordsOrdered
└── layout: viewer | drag handle | TextPanel
                                    ├── header: status + Export JSON + Export PDF
                                    ├── tabs: Text | Annotations
                                    ├── Text tab: search · expand-all · copy-all · SelectionControls · page cards
                                    └── Annotations tab: sort · sortable list with note edit + delete

PdfViewerPane    — unchanged from Part 2, but the viewer's Uint8Array clone now also lets OCR + pdf-lib reuse the source
HighlightOverlay — renders N rectangles per annotation (one per word bbox) + a selection outline per selected word
ocr.ts           — builds the hierarchical tree alongside the flat word list, sharing OcrWord refs
pdfAnnotator.ts  — new: pdf-lib helper that adds /Highlight annotations to a PDF and returns new bytes
```

## Data types

```ts
// src/frontend/apps/doc-viewer/types.ts

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  pageIndex: number
}
export type WordBbox = Omit<BoundingBox, 'pageIndex'>

export interface OcrWord {
  id: string                  // `p${pageIndex}-w${wordIndex}` — stable, document-order
  text: string
  confidence: number
  bbox: BoundingBox
}

export interface OcrLine        { words: OcrWord[] }
export interface OcrParagraph   { lines: OcrLine[] }
export interface OcrBlock       { paragraphs: OcrParagraph[] }

export interface OcrPage {
  pageIndex: number
  width: number               // page width in pixels at OCR resolution
  height: number              // page height in pixels at OCR resolution
  words: OcrWord[]            // flat, document-order — for selection / search / id lookup
  blocks: OcrBlock[]          // hierarchical — same OcrWord refs as `words`
}

export type FileType  = 'pdf' | 'image'
export type OcrStatus = 'idle' | 'running' | 'done' | 'error'

export type AnnotationColor = 'yellow' | 'green' | 'pink' | 'blue'

export interface Annotation {
  id: string
  wordIds: string[]           // one or more OcrWord.id, in document order
  pageIndex: number           // first word's page (for jump + sort)
  color: AnnotationColor
  note: string
  createdAt: number
  text: string                // snapshot, words joined by space
  bboxes: WordBbox[]          // one bbox per wordId, in same order
}

// Legacy single-word shape — keep for the localStorage migration
export interface LegacyAnnotation {
  id: string
  wordId: string
  pageIndex: number
  color: AnnotationColor
  note: string
  createdAt: number
  text: string
  bbox: WordBbox
}

export type AnnotationsByFile = Record<string, Annotation[]>
export type PanelTab          = 'text' | 'annotations'
```

## Dependencies

```bash
npm install pdf-lib
```

(`tesseract.js`, `pdfjs-dist`, `@react-pdf-viewer/*` already installed in Part 2.)

## Task

Implement the seven features above. Treat the existing Part 2 code as the starting point and modify/extend it; do not rewrite untouched concerns.

## Output format

### 1. `src/frontend/apps/doc-viewer/types.ts`

Replace the entire file with the types above. The new shape supersedes Part 2's single-word `Annotation`; the `LegacyAnnotation` type is only used by the migration helper in `index.tsx`.

### 2. `src/frontend/apps/doc-viewer/ocr.ts`

Update `runOcrOnImage` to:
- Call `worker.recognize(dataUrl, {}, { blocks: true, text: true })` — tesseract.js v7 defaults to `text` only and leaves `data.blocks` null without the explicit output option
- Build both representations in one pass:
  - Walk `data.blocks[].paragraphs[].lines[].words`
  - Create each `OcrWord` once via a helper that pushes to a `flatWords: OcrWord[]` and returns the same reference
  - Filter out empty-text words and drop empty lines/paragraphs/blocks
  - Both `OcrPage.words` (the flat list) and `OcrPage.blocks` (the tree) end up holding the same `OcrWord` objects by reference
- Return `{ pageIndex, width, height, words: flatWords, blocks }`

In `runOcrOnPdf`, clone the buffer before passing to pdf.js: `pdfjsLib.getDocument({ data: pdfData.slice() })`. pdf.js transfers `data` to its worker, detaching the original buffer; without the clone the same buffer would already be detached by react-pdf-viewer's instance.

### 3. `src/frontend/apps/doc-viewer/PdfViewerPane.tsx`

- Drop the `activeWord` prop and the effect that called `jumpToPage` on it — selection-driven jumps are handled in the parent now via the ref.
- Clone `fileData` once with `useMemo`: `new Uint8Array(fileData)`. Pass the clone to `<Viewer fileUrl={...}>`. pdf.js will detach the clone's buffer; the parent's source stays intact for OCR and PDF export.

### 4. `src/frontend/apps/doc-viewer/HighlightOverlay.tsx`

Props:
```ts
interface HighlightOverlayProps {
  selectedWords: OcrWord[]
  annotations: Annotation[]
  ocrPages: OcrPage[]
}
```

- Render one `<div>` per annotation bbox (so a 3-word highlight renders 3 boxes), keyed `ann-${id}-${i}`. Color class lookup keyed by `AnnotationColor` — use static class strings so Tailwind's content scanner finds them.
- Render one `<div>` per selected word as a yellow outline (`border-2 border-yellow-500 ring-2 ring-yellow-300/60`), keyed `sel-${wordId}`.
- All boxes use `position: fixed` (so they live above viewer chrome) and `pointer-events-none`.
- Position via a `requestAnimationFrame` loop in `useEffect`. Each frame, for each box:
  1. Look up the rendered page DOM element by `document.querySelector('[data-testid="core__page-layer-' + pageIndex + '"]')`
  2. If missing (page virtualized out) → `el.style.display = 'none'`
  3. Else: `getBoundingClientRect()` of the page element, scale OCR coords by `pageEl.clientWidth / ocrPage.width` (same for Y), write `left/top/width/height` directly to `el.style`
- Use refs (not React state) for the per-frame positioning so re-renders only fire when the *set* of annotations or selected words changes.

### 5. `src/frontend/apps/doc-viewer/pdfAnnotator.ts` (new)

```ts
export async function embedAnnotationsInPdf(
  pdfBytes: Uint8Array,
  annotations: Annotation[],
  ocrPages: OcrPage[],
): Promise<Uint8Array>
```

- Dynamically import `pdf-lib` inside the function so it stays out of the main bundle.
- Load the PDF with `PDFDocument.load(pdfBytes)`. For each annotation:
  - Look up the page (`pdfDoc.getPages()[pageIndex]`) and the matching OCR page
  - Compute `scaleX = page.getWidth() / ocrPage.width`, `scaleY = page.getHeight() / ocrPage.height`
  - For each bbox, convert OCR (top-left origin, pixels) to PDF (bottom-left origin, points):
    - `xL = bbox.x * scaleX`, `xR = (bbox.x + bbox.width) * scaleX`
    - `yTop = pageHeight - bbox.y * scaleY`, `yBot = pageHeight - (bbox.y + bbox.height) * scaleY`
  - Build a `QuadPoints` flat array using Adobe convention `[xL, yTop, xR, yTop, xL, yBot, xR, yBot]` per word, and an overall `Rect [minX, minY, maxX, maxY]` covering all bboxes
  - Create the annotation dict with `pdfDoc.context.obj({ Type, Subtype: 'Highlight', Rect, QuadPoints, C: rgb, CA: 0.5, F: 4, Contents: PDFString.of(note || text), T: PDFString.of('Snappet'), M: PDFString.of(pdfDate) })`
  - `pdfDoc.context.register(dict)` → `PDFRef`, then `page.node.addAnnot(ref)`
- `return await pdfDoc.save()`

Color mapping (RGB 0–1 floats matching Tailwind `*-300`):
```ts
const COLOR_RGB: Record<AnnotationColor, [number, number, number]> = {
  yellow: [0.992, 0.878, 0.278],
  green:  [0.525, 0.937, 0.675],
  pink:   [0.976, 0.659, 0.831],
  blue:   [0.576, 0.773, 0.992],
}
```

### 6. `src/frontend/apps/doc-viewer/index.tsx`

State:
```ts
const [selectedWordIds, setSelectedWordIds] = useState<string[]>([])
const [annotationsByFile, setAnnotationsByFile] =
  useLocalStorage<Record<string, Array<Annotation | LegacyAnnotation>>>(
    'snappet:doc-viewer:annotations', {})
const [panelWidth, setPanelWidth] =
  useLocalStorage<number>('snappet:doc-viewer:panelWidth', 320)
const [isResizing, setIsResizing] = useState(false)
const [isExportingPdf, setIsExportingPdf] = useState(false)
```

Derived (all `useMemo`):
- `annotations: Annotation[]` — `(annotationsByFile[fileName] ?? []).map(migrateAnnotation)`
- `annotationByWordId: Map<string, Annotation>` — every wordId in every annotation maps to that annotation (1:1 because we enforce non-overlap)
- `allWordsOrdered: OcrWord[]` — `ocrPages.flatMap(p => p.words)`
- `selectedWords: OcrWord[]` — `allWordsOrdered` filtered by a Set of `selectedWordIds`, preserving document order

`migrateAnnotation(raw)` helper:
- Returns `raw` if already in the new shape (`'wordIds' in raw && Array.isArray(raw.wordIds)`)
- Otherwise wraps legacy `{ wordId, bbox, … }` into `{ wordIds: [wordId], bboxes: [bbox], … }`

Handlers:
- `handleSetSelection(wordIds)` — dedupe preserving first-seen order, set state, jump PDF viewer to the first word's page (if PDF). Used for click/drag/shift/cmd selection *and* for jumps from the annotations list.
- `handleApplyColorToSelection(color)`:
  - If an annotation's `wordIds` set-equals the current selection and the color matches → remove it (toggle off)
  - Same selection, different color → update color
  - Otherwise → drop any annotations whose wordIds overlap the selection (enforces 1:1) and create a new one. Snapshot bboxes + joined text in document order.
- `handleRemoveAnnotation(annotationId)` — by id
- `handleUpdateNote(annotationId, note)` — by id (callers always have the id: SelectionControls reads `currentAnnotation`, list view reads each row)
- `handleExport()` — download `{fileName, fileType, exportedAt, pages: [{pageIndex, text, wordCount}], annotations}` as JSON
- `handleDownloadAnnotatedPdf()` — only for PDFs with ≥1 annotation. Set `isExportingPdf`, clone `fileData` via `new Uint8Array(fileData)`, call `embedAnnotationsInPdf`, wrap the returned bytes with `new Blob([new Uint8Array(out).buffer], …)` (the buffer re-wrap is needed because TS narrows `Uint8Array<ArrayBufferLike>` to a non-Blob-compatible type otherwise), trigger download as `${name}-annotated.pdf`.

Resizable splitter:
- `useEffect` toggled by `isResizing` attaches `mousemove`/`mouseup` to `document`. `mousemove` computes `window.innerWidth - clientX`, clamps to `[240, 800]`, calls `setPanelWidth`.
- When `isResizing`, render a `<div className="fixed inset-0 z-[100] cursor-col-resize select-none" />` overlay so the cursor stays consistent and the PDF viewer doesn't steal the move events.

Layout (when a file is loaded):
```
┌──────────────────────────────────────────────────────────────┐
│ Top bar: title · Reset                                       │
├──────────────────┬───┬─────────────────────────────────────┐
│                  │ ░ │                                     │
│  Viewer +        │ ░ │   TextPanel                         │
│  HighlightOver   │ ░ │   (width = panelWidth)              │
│  (flex-1)        │ ░ │                                     │
│                  │ ░ │                                     │
└──────────────────┴───┴─────────────────────────────────────┘
                    ^ drag handle: w-1, cursor-col-resize, blue on hover
```

Upload screen: below the "Supported: PDF, PNG, JPG" hint, add a small subtle line:
> 🔒 All OCR and processing happens in your browser. Your file never leaves your device.

### 7. `src/frontend/apps/doc-viewer/TextPanel.tsx`

Slim orchestrator. Props mirror what `index.tsx` exposes (pages, annotations, annotationByWordId, allWordsOrdered, selectedWordIds, selectedWords, the 5 handlers above, plus `canDownloadAnnotatedPdf`, `isExportingPdf`, `onDownloadAnnotatedPdf`, status/progress/errorMessage).

Header:
- Title "Extracted Text"
- When `status === 'done'` and `canDownloadAnnotatedPdf` and `annotations.length > 0`: a primary blue button "↓ PDF" calling `onDownloadAnnotatedPdf` (disabled + spinner while `isExportingPdf`)
- When `status === 'done'`: a subtle "↓ JSON" button calling `onExport`
- Status badge pill (idle / running / done / error)
- When `status === 'done'`: tab switcher Text | Annotations (N)

Body branches on status:
- idle / running / error: same as Part 2
- done + Text tab: render `<OcrTextView />`
- done + Annotations tab: render `<AnnotationsListView />`

### 8. `src/frontend/apps/doc-viewer/OcrTextView.tsx` (new)

Top of view (sticky, non-scrolling):
- Search input (placeholder "Search words…")
- `Expand all` / `Collapse all` toggle + `Copy all` link
- **SelectionControls** (only when `selectedWords.length > 0`): shows count + truncated joined text + `clear` link; row of 4 color swatches; if there's a current annotation, a textarea for the note (commits on blur)
- Tip line when nothing is selected: "drag across words, or shift+click for a range, or ⌘/Ctrl+click to toggle"

Body — scrollable list of page cards. Each card:
- Header: `Page N · M words · K paragraphs · L low-conf` (paragraphs only shown when > 1, low-conf only when > 0), collapse toggle, per-page `Copy` link
- Body (when expanded): walk `page.blocks.map(block => block.paragraphs.map(para => …))`
  - Wrap each block in a left-border container only when `page.blocks.length > 1` (otherwise no wrapper)
  - Each paragraph is a `<p className="mb-2 last:mb-0">`
  - Within a paragraph, render each line in a `<span>` with `<br />` between lines so the line layout from the source PDF is roughly preserved
  - Each word is a clickable `<span>` with the trailing space outside the span
  - When `search` is active, hide entire paragraphs with no matching word (don't just dim); within shown paragraphs, underline matches and dim non-matches

Selection logic:
- `wordOrder: Map<wordId, index>` derived from `allWordsOrdered` for O(1) range computation
- `dragAnchorRef: useRef<string|null>` — set on plain mousedown
- `onMouseDown(word, e)`:
  - `e.preventDefault()` (suppress native text selection)
  - shiftKey: `onSetSelection(rangeBetween(wordOrder, selectedWordIds[0] ?? word.id, word.id, allWordsOrdered))`
  - metaKey/ctrlKey: toggle word in selection set
  - otherwise: start drag, `onSetSelection([word.id])`
- `onMouseEnter(word)`: if dragging, extend `onSetSelection(rangeBetween(...))`
- Window `mouseup` listener clears `dragAnchorRef`
- The `<p>` wrapping the words gets `className="select-none"` and an `onDragStart={e => e.preventDefault()}`

`currentAnnotation` (memo): if `selectedWordIds[0]` has an entry in `annotationByWordId` AND that annotation's `wordIds` set-equals the selection → return it. Used to know whether to show the note textarea and which swatch is "current".

Auto-scroll the last selected word into view, keyed on `selectedWordIds[selectedWordIds.length - 1]` so the scroll doesn't yank during drag-extend on every word.

Auto-expand pages that contain any selected word so the scroll target exists.

`pageText(page)` (used by Copy buttons): structure-aware. Words within a line joined by space, lines within a paragraph joined by space, paragraphs separated by a blank line.

### 9. `src/frontend/apps/doc-viewer/AnnotationsListView.tsx` (new)

Top: sort pills (Page / Newest / Color), aria-pressed on active.

List: one card per annotation. Card highlights with a blue ring when its `wordIds` set-equals the current `selectedWordIds`.

Each card:
- Color dot + truncated text + `Page N · K word(s)`
- Click anywhere in that region → `onJump(ann)` → parent calls `handleSetSelection(ann.wordIds)`
- ✕ button on the right → `onRemove(ann.id)`
- Below: the note. If empty, shows italic "Add a note…". Click to edit inline — textarea autofocuses, commits on blur, Escape cancels.

Empty state: "No annotations yet. Select some words in the Text tab, then pick a color."

## Constraints

- **No data leaves the browser.** Tesseract WASM, pdf.js, and pdf-lib all run client-side. The privacy line in the upload screen documents this and must remain accurate — don't introduce any network call that uploads document bytes.
- Dynamic imports: `tesseract.js` and `pdfjs-dist` stay dynamic (already done in Part 2); `pdf-lib` must be dynamically imported inside `embedAnnotationsInPdf`.
- TypeScript strict — no `any`. The legacy-annotation migration is the only place that reads a wider type; everything else operates on the post-migration `Annotation`.
- Annotations are persisted under a single `'snappet:doc-viewer:annotations'` localStorage key as a `{ fileName: Annotation[] }` map. When a file's array becomes empty, drop the key entirely so storage stays tidy.
- Enforce 1:1 between word and annotation — creating an annotation that overlaps existing ones drops the overlapping ones. Document this in the UI's tip line implicitly by not supporting overlap.
- The `OcrWord` references shared between `OcrPage.words` (flat) and `OcrPage.blocks` (tree) must be the *same objects*. Selection, search, and rendering all rely on identity equality of word ids — the shared refs keep id generation simple.
- Dark mode on every new UI element (`bg-*`/`text-*`/`border-*` paired with `dark:` variants).
- Tailwind color/ring class lookups for annotations must be static string literals in `Record<AnnotationColor, string>` objects so the content scanner picks them up — never build class names with template-string interpolation.
- Coordinates: OCR bboxes are in canvas-pixel space at `OCR_SCALE = 2`; `OcrPage.width/height` match that scaled canvas. PDF embedding scales back to PDF points and flips Y for PDF's bottom-left origin.
- Don't break the existing Part 1/2 contract: the upload UI, two-panel layout, status badge, idle/running/error states, and PDF/image viewer panes continue to work the same way; selection and annotation features are additive.

## Notes for future work

- A "Notes-only" PDF (annotations on a blank page set, no source) export would be a small extension of `pdfAnnotator.ts`.
- Streaming OCR results into the panel as each page completes (instead of all at once) is a UX win for large PDFs — would require lifting `setOcrPages` into the page-by-page loop in `runOcrOnPdf`.
- Self-hosting the Tesseract WASM core + traineddata (rather than the jsdelivr defaults) would make the app fully offline and remove the only external network requests.
