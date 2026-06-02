import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Regex Playground',
    body: "A quick tour of how to build and test regular expressions. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'pattern',
    title: 'Write your pattern',
    body: 'Type a regular expression here. Matches update live as you type.',
  },
  {
    target: 'flags',
    title: 'Toggle flags',
    body: 'Switch on global, case-insensitive, multiline, or dotAll to change how matching works.',
  },
  {
    target: 'test',
    title: 'Add a test string',
    body: 'Paste the text to search. Matches are highlighted in the preview just below.',
  },
  {
    target: 'details',
    title: 'See matches and explanation',
    body: 'Inspect each match and its capture groups, with a plain-English breakdown of your pattern.',
  },
  {
    target: 'library',
    title: 'Grab a common pattern',
    body: 'Open the library for ready-made patterns. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
