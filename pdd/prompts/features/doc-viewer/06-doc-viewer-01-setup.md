# Prompt: Document Viewer — Part 1: Setup + PDF Rendering

**File**: pdd/prompts/features/doc-viewer/06-doc-viewer-01-setup.md
**Created**: 2026-03-31
**Project type**: Frontend / Web app
**Chain**: 1 of 2 — run this first, then 06-doc-viewer-02-ocr-linking.md
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps deployed on GitHub Pages (fully client-side, no backend). This is the Document Viewer mini-app at `/doc-viewer`.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy), React Router v6, Vite.

**Heavy dependencies** — these are an intentional exception to the "no heavy deps" rule because OCR is the core feature. Both must be **dynamically imported** (not static imports at the top level) so they only load when the user opens `/doc-viewer`:
- `@react-pdf-viewer/core` + `@react-pdf-viewer/default-layout` + `pdfjs-dist@3.x`
- `tesseract.js` (added in part 2)

**Conventions**:
- `useLocalStorage` hook available at `src/frontend/hooks/useLocalStorage.ts`
- Every mini-app has an `↺ Reset` button (top-right of header, muted red-on-hover style)
- Files go in `src/frontend/apps/doc-viewer/`
- Default export from `index.tsx`
- All user-facing state persisted via `useLocalStorage('snappet:doc-viewer:<field>', default)`

## Task

Build the Document Viewer mini-app shell: file upload (PDF, PNG, JPG), full-featured PDF rendering using `@react-pdf-viewer` with the `defaultLayoutPlugin` (which provides thumbnails, bookmarks, toolbar, search, zoom, scroll modes, rotation, print, download, full-screen), and image display for non-PDF files.

## Dependencies to install

```bash
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout pdfjs-dist@3.11.174
```

## Input

Fresh folder `src/frontend/apps/doc-viewer/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. `src/frontend/apps/doc-viewer/index.tsx`

Top-level component. Manages upload state and conditionally renders the viewer.

**States** (all via `useLocalStorage` except `file` and `error`):
```ts
const [fileName, setFileName] = useLocalStorage<string | null>('snappet:doc-viewer:fileName', null)
const [fileType, setFileType] = useLocalStorage<'pdf' | 'image' | null>('snappet:doc-viewer:fileType', null)
const [file, setFile] = useState<Uint8Array | string | null>(null) // not persisted — File objects can't be JSON serialized
const [error, setError] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
```

**Note on persistence**: The file binary itself cannot be stored in localStorage (too large). On mount, if `fileName` is set but `file` is null, show a "Re-upload [fileName] to restore your session" prompt. This is the expected UX — we persist the filename/type as metadata but not the binary.

**Upload UI** (shown when `file === null`):
- Large centered drop zone:
  - Dashed border, rounded-2xl
  - Icon + "Drop a PDF or image here" text
  - "or click to browse" subtext
  - Supports drag-and-drop (`onDragOver`, `onDrop`)
  - Hidden `<input type="file" accept=".pdf,.png,.jpg,.jpeg">` triggered on click
  - Shows re-upload hint if `fileName` is set (from previous session)
- Accepted formats label: "PDF, PNG, JPG"
- `error` shown in red below the drop zone if set

**File processing** (on file select or drop):
1. Validate: only accept `application/pdf`, `image/png`, `image/jpeg` — set error and return otherwise
2. Read the file as ArrayBuffer → convert to `Uint8Array` (for PDF) or `FileReader.readAsDataURL` (for images)
3. Set `file`, `fileName`, `fileType`
4. Clear `error`

**Viewer area** (shown when `file !== null`):
- Full height layout (`h-screen` or `calc(100vh - header height)`)
- For PDF: renders `<PdfViewerPane>` (see file 2)
- For image: renders `<ImageViewerPane>` (see file 3)
- Reset button (top-right) clears `file`, `fileName`, `fileType`, `error` back to null — returns to upload UI

**Reset**: clears all state → returns to upload drop zone.

### 2. `src/frontend/apps/doc-viewer/PdfViewerPane.tsx`

Props:
```ts
interface PdfViewerPaneProps {
  fileData: Uint8Array
  fileName: string
}
```

Renders the full-featured PDF viewer using `@react-pdf-viewer`:

**Dynamic import pattern** (critical — prevents loading pdfjs on hub page):
```ts
// At the top of the file, use React.lazy for the inner viewer component
// OR use a useEffect + dynamic import to load the plugin and render
// Preferred: use React.lazy + Suspense at the parent level
```

**Implementation**:
- Import `Worker`, `Viewer` from `@react-pdf-viewer/core`
- Import `defaultLayoutPlugin` from `@react-pdf-viewer/default-layout`
- Import CSS: `@react-pdf-viewer/core/lib/styles/index.css` and `@react-pdf-viewer/default-layout/lib/styles/index.css`
- Worker URL: `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`
- `defaultLayoutPlugin()` provides: sidebar (thumbnails, bookmarks, attachments) + full toolbar (zoom, page nav, search, scroll mode, rotation, print, download, full-screen, text select / hand tool)
- Wrap viewer in a container div with `height: calc(100vh - 120px)` (accounts for Snappet header)
- Dark mode: pass `theme={isDark ? 'dark' : 'light'}` using the `useDarkMode` hook from `../../hooks/useDarkMode`
- `defaultScale={SpecialZoomLevel.PageWidth}` for good default fit
- Show a loading spinner (centered, Tailwind-styled) while the document loads via `renderLoader`

**File name display**: show `fileName` in a small bar above the viewer (left-aligned, muted text, with a file icon emoji 📄).

### 3. `src/frontend/apps/doc-viewer/ImageViewerPane.tsx`

Props:
```ts
interface ImageViewerPaneProps {
  fileData: string  // data URL from FileReader.readAsDataURL
  fileName: string
}
```

Simple image viewer:
- Display the image centered, `max-h-[calc(100vh-160px)]`, `max-w-full`, `object-contain`
- Show `fileName` above the image (same style as PDF pane)
- Zoom controls: `+` / `−` buttons and a percentage display (state: `zoom` from 50–300%, step 10)
- Apply zoom via `transform: scale(zoom/100)` with `transition-transform`
- Reset zoom button

This pane is a placeholder for Part 2 where OCR will be added alongside it.

### 4. `src/frontend/router/routes.tsx` (updated)

Add the doc-viewer route:
```ts
{
  path: '/doc-viewer',
  label: 'Document Viewer',
  description: 'View PDFs and images with full-featured viewer and OCR text extraction.',
  category: 'Utilities',
  icon: '📄',
  component: lazy(() => import('../apps/doc-viewer')),
}
```

## Constraints

- `pdfjs-dist`, `@react-pdf-viewer/core`, and `@react-pdf-viewer/default-layout` must NOT be statically imported at module level in any file that is part of the main bundle. Use dynamic `import()` or ensure these files are only ever imported from within the `doc-viewer` app folder (Vite will code-split them automatically since the route is lazy-loaded).
- The `Worker` component from `@react-pdf-viewer/core` must wrap the `Viewer`. Use the CDN worker URL for `pdfjs-dist@3.11.174`.
- No inline styles — Tailwind only (except for the viewer container height which requires `style={{ height: '...' }}` since Tailwind can't express dynamic calc values without arbitrary classes)
- TypeScript strict — no `any`
- Dark mode on all custom UI (drop zone, loading states, error messages, file name bar)
- Drop zone must support both click-to-browse and drag-and-drop
- File validation: reject files that are not PDF/PNG/JPG with a clear error message
- The `@react-pdf-viewer` CSS imports are required — import them inside the `PdfViewerPane.tsx` file only
