import type { Annotation, OcrPage, AnnotationColor } from './types'

// Tailwind highlight colors (yellow-300, green-300, pink-300, blue-300)
// expressed as PDF RGB triplets in the 0–1 range.
const COLOR_RGB: Record<AnnotationColor, [number, number, number]> = {
  yellow: [0.992, 0.878, 0.278],
  green: [0.525, 0.937, 0.675],
  pink: [0.976, 0.659, 0.831],
  blue: [0.576, 0.773, 0.992],
}

// PDF date format per spec: D:YYYYMMDDHHmmSS  (we omit the timezone offset —
// most readers accept that).
function pdfDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    'D:' +
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/**
 * Embed our annotations as native PDF Highlight annotations and return the
 * resulting bytes. The note text becomes the annotation's `/Contents`, which
 * most PDF readers expose via a click/hover popup.
 *
 * Coordinate conversion: OCR bboxes are in canvas-pixel space with origin
 * top-left and dimensions matching `ocrPage.width`/`ocrPage.height`. PDF uses
 * points with origin bottom-left, so we scale to the page's point dimensions
 * and flip Y.
 */
export async function embedAnnotationsInPdf(
  pdfBytes: Uint8Array,
  annotations: Annotation[],
  ocrPages: OcrPage[],
): Promise<Uint8Array> {
  // Dynamic import keeps pdf-lib out of the main bundle — only loaded when the
  // user actually exports an annotated PDF.
  const { PDFDocument, PDFString } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const ocrByIdx = new Map(ocrPages.map((p) => [p.pageIndex, p]))

  for (const ann of annotations) {
    const page = pages[ann.pageIndex]
    const ocrPage = ocrByIdx.get(ann.pageIndex)
    if (!page || !ocrPage || ocrPage.width === 0 || ocrPage.height === 0) continue

    const pdfWidth = page.getWidth()
    const pdfHeight = page.getHeight()
    const scaleX = pdfWidth / ocrPage.width
    const scaleY = pdfHeight / ocrPage.height

    // Build QuadPoints (one quad per word) and the overall bounding Rect.
    // Adobe convention for highlight QuadPoints: top-left, top-right,
    // bottom-left, bottom-right per quadrilateral.
    const quadPoints: number[] = []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const bbox of ann.bboxes) {
      const xL = bbox.x * scaleX
      const xR = (bbox.x + bbox.width) * scaleX
      const yTop = pdfHeight - bbox.y * scaleY
      const yBot = pdfHeight - (bbox.y + bbox.height) * scaleY

      quadPoints.push(xL, yTop, xR, yTop, xL, yBot, xR, yBot)

      if (xL < minX) minX = xL
      if (xR > maxX) maxX = xR
      if (yBot < minY) minY = yBot
      if (yTop > maxY) maxY = yTop
    }

    const [r, g, b] = COLOR_RGB[ann.color]

    const highlightDict = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Highlight',
      Rect: [minX, minY, maxX, maxY],
      QuadPoints: quadPoints,
      C: [r, g, b],
      CA: 0.5,                       // opacity
      F: 4,                          // print flag → highlight visible when printed
      Contents: PDFString.of(ann.note || ann.text),
      T: PDFString.of('Snappet'),    // author
      M: PDFString.of(pdfDate(ann.createdAt)),
    })

    const ref = pdfDoc.context.register(highlightDict)
    page.node.addAnnot(ref)
  }

  return await pdfDoc.save()
}
