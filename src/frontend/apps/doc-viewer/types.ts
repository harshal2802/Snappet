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

export interface OcrPage {
  pageIndex: number    // 0-indexed
  width: number        // page width in pixels at OCR resolution
  height: number       // page height in pixels at OCR resolution
  words: OcrWord[]
}

export type FileType = 'pdf' | 'image'
export type OcrStatus = 'idle' | 'running' | 'done' | 'error'
