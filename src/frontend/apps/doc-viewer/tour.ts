import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Document Viewer',
    body: 'A quick tour of opening and reading your files. It takes about 20 seconds — you can skip anytime.',
  },
  {
    target: 'dropzone',
    title: 'Open a document',
    body: 'Drop a PDF or image here, or click to browse for a file on your device.',
  },
  {
    target: 'privacy',
    title: 'Stays on your device',
    body: 'Everything runs in your browser — your file never gets uploaded anywhere.',
  },
  {
    target: 'features',
    title: 'What you can do',
    body: 'Search, zoom, rotate, print, and even extract text with OCR once a file is open.',
  },
]
