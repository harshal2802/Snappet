import { useEffect, useRef } from 'react'
import type { OcrWord, OcrPage, Annotation, AnnotationColor, WordBbox } from './types'

interface HighlightOverlayProps {
  selectedWords: OcrWord[]
  annotations: Annotation[]
  ocrPages: OcrPage[]
}

// Static class strings so Tailwind's content scanner finds them.
const COLOR_CLASS: Record<AnnotationColor, string> = {
  yellow: 'bg-yellow-300/45 border-yellow-500/80',
  green: 'bg-green-300/45 border-green-500/80',
  pink: 'bg-pink-300/45 border-pink-500/80',
  blue: 'bg-blue-300/45 border-blue-500/80',
}

function positionEl(
  el: HTMLElement,
  pageIndex: number,
  bbox: WordBbox,
  ocrPageByIdx: Map<number, OcrPage>,
) {
  const page = ocrPageByIdx.get(pageIndex)
  const pageEl = document.querySelector(
    `[data-testid="core__page-layer-${pageIndex}"]`,
  ) as HTMLElement | null

  if (!page || !pageEl || pageEl.clientWidth === 0 || page.width === 0) {
    el.style.display = 'none'
    return
  }

  const rect = pageEl.getBoundingClientRect()
  const scaleX = pageEl.clientWidth / page.width
  const scaleY = pageEl.clientHeight / page.height
  el.style.display = 'block'
  el.style.left = `${rect.left + bbox.x * scaleX}px`
  el.style.top = `${rect.top + bbox.y * scaleY}px`
  el.style.width = `${bbox.width * scaleX}px`
  el.style.height = `${bbox.height * scaleY}px`
}

export default function HighlightOverlay({
  selectedWords,
  annotations,
  ocrPages,
}: HighlightOverlayProps) {
  const refs = useRef(new Map<string, HTMLDivElement | null>())

  useEffect(() => {
    const ocrPageByIdx = new Map(ocrPages.map((p) => [p.pageIndex, p]))
    let frameId: number | null = null

    function update() {
      for (const ann of annotations) {
        ann.bboxes.forEach((bbox, i) => {
          const el = refs.current.get(`ann-${ann.id}-${i}`)
          if (el) positionEl(el, ann.pageIndex, bbox, ocrPageByIdx)
        })
      }
      for (const w of selectedWords) {
        const el = refs.current.get(`sel-${w.id}`)
        if (el) positionEl(el, w.bbox.pageIndex, w.bbox, ocrPageByIdx)
      }
      frameId = requestAnimationFrame(update)
    }

    update()
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [selectedWords, annotations, ocrPages])

  return (
    <>
      {annotations.flatMap((a) =>
        a.bboxes.map((_, i) => (
          <div
            key={`ann-${a.id}-${i}`}
            ref={(el) => {
              refs.current.set(`ann-${a.id}-${i}`, el)
            }}
            aria-hidden="true"
            className={`fixed pointer-events-none z-40 rounded-sm border ${COLOR_CLASS[a.color]}`}
            style={{ display: 'none' }}
          />
        )),
      )}
      {selectedWords.map((w) => (
        <div
          key={`sel-${w.id}`}
          ref={(el) => {
            refs.current.set(`sel-${w.id}`, el)
          }}
          aria-hidden="true"
          className="fixed pointer-events-none z-50 rounded-sm border-2 border-yellow-500 ring-2 ring-yellow-300/60"
          style={{ display: 'none' }}
        />
      ))}
    </>
  )
}
