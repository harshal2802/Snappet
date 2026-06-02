import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Video Editor',
    body: 'A quick tour of editing clips right in your browser. It takes about 20 seconds — you can skip anytime.',
  },
  {
    target: 'import',
    title: 'Add your media',
    body: 'Drop a video here or click to browse. Everything stays on your device.',
  },
  {
    target: 'preview',
    title: 'Preview',
    body: 'Watch your edit play back here, with controls for scrubbing and full-screen.',
  },
  {
    target: 'toolbar',
    title: 'Editing tools',
    body: 'Split, duplicate, delete, add text, set the aspect ratio, and zoom from this toolbar.',
  },
  {
    target: 'timeline',
    title: 'The timeline',
    body: 'Arrange and trim your clips here. Drag to reposition and pinch or zoom to focus.',
  },
  {
    target: 'export',
    title: 'Export when ready',
    body: 'Render your finished video to a file — no upload, all done locally.',
  },
]
