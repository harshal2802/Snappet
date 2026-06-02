import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to Code Snapshot',
    body: "A quick tour of how to turn code into a shareable image. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'code',
    title: 'Paste your code',
    body: 'Drop any snippet here. The preview below updates live as you type.',
  },
  {
    target: 'preview',
    title: 'See the live preview',
    body: 'This is exactly what gets exported, syntax-highlighted and styled.',
  },
  {
    target: 'controls',
    title: 'Style it',
    body: 'Choose the language, theme, background, padding, and more to make it your own.',
  },
  {
    target: 'export',
    title: 'Copy or download',
    body: 'Copy the image to your clipboard or download a PNG. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
