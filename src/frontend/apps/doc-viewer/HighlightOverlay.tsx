import type { OcrWord, OcrPage } from './types'

interface HighlightOverlayProps {
  activeWord: OcrWord | null
  ocrPages: OcrPage[]
  // Rendered page dimensions — supplied by the parent measuring the viewer container
  containerWidth: number
  containerHeight: number
}

export default function HighlightOverlay({
  activeWord,
  ocrPages,
  containerWidth,
  containerHeight,
}: HighlightOverlayProps) {
  if (!activeWord || containerWidth === 0 || containerHeight === 0) return null

  const ocrPage = ocrPages.find((p) => p.pageIndex === activeWord.bbox.pageIndex)
  if (!ocrPage || ocrPage.width === 0 || ocrPage.height === 0) return null

  const scaleX = containerWidth / ocrPage.width
  const scaleY = containerHeight / ocrPage.height

  const left = activeWord.bbox.x * scaleX
  const top = activeWord.bbox.y * scaleY
  const width = activeWord.bbox.width * scaleX
  const height = activeWord.bbox.height * scaleY

  return (
    <div
      aria-hidden="true"
      className="absolute pointer-events-none transition-opacity duration-150 z-10"
      style={{ left, top, width, height }}
    >
      <div className="w-full h-full bg-yellow-300/50 dark:bg-yellow-500/40 border border-yellow-400 dark:border-yellow-500 rounded-sm" />
    </div>
  )
}
