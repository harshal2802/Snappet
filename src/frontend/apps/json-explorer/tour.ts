import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to JSON Explorer',
    body: "A quick tour of how to format, explore, and diff JSON. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'mode',
    title: 'Pick a mode',
    body: 'Use “Explorer” to inspect a single JSON document, or “Diff” to compare two of them.',
  },
  {
    target: 'input',
    title: 'Paste your JSON',
    body: 'Drop any JSON here. It parses live and tells you right away if something is off.',
  },
  {
    target: 'toolbar',
    title: 'Format, minify, copy',
    body: 'Tidy up your JSON with Format, shrink it with Minify, or grab it with Copy.',
  },
  {
    title: 'That’s it',
    body: 'A collapsible tree appears below once your JSON is valid. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
