export interface BoundingBox {
  x: number        // pixels from left of page
  y: number        // pixels from top of page
  width: number
  height: number
  pageIndex: number // 0-indexed
}

export interface OcrWord {
  id: string           // `p${pageIndex}-w${wordIndex}`
  text: string
  confidence: number   // 0–100
  bbox: BoundingBox
}

export interface OcrLine {
  words: OcrWord[]     // same word objects (by reference) as in OcrPage.words
}

export interface OcrParagraph {
  lines: OcrLine[]
}

export interface OcrBlock {
  paragraphs: OcrParagraph[]
}

export interface OcrPage {
  pageIndex: number    // 0-indexed
  width: number        // page width in pixels at OCR resolution
  height: number       // page height in pixels at OCR resolution
  words: OcrWord[]     // flat, document-order — kept for selection / search / id lookup
  blocks: OcrBlock[]   // hierarchical, same OcrWord refs as `words`
}

export type FileType = 'pdf' | 'image'
export type OcrStatus = 'idle' | 'running' | 'done' | 'error'

export type AnnotationColor = 'yellow' | 'green' | 'pink' | 'blue'

export type WordBbox = Omit<BoundingBox, 'pageIndex'>

export interface Annotation {
  id: string
  wordIds: string[]                           // one or more OcrWord.id values
  pageIndex: number                           // first selected word's page (for sort/jump)
  color: AnnotationColor
  note: string
  createdAt: number
  text: string                                // snapshot of selected text (joined by space)
  bboxes: WordBbox[]                          // one bbox per wordId, in same order
}

// Legacy shape stored in localStorage prior to multi-word selection.
// Kept here so the migration in index.tsx can read it without `any`.
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

// Persisted across files so re-uploading restores annotations.
export type AnnotationsByFile = Record<string, Annotation[]>

export type PanelTab = 'text' | 'annotations'
