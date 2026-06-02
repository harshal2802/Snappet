import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Markdown Editor',
    body: "A quick tour of writing, previewing, and exporting Markdown. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'toolbar',
    title: 'Formatting toolbar',
    body: 'Quickly add bold, italics, headings, links, and more to the text you have selected.',
  },
  {
    target: 'editor',
    title: 'Write here',
    body: 'Type your Markdown in this pane. Everything you write renders instantly on the right.',
  },
  {
    target: 'preview',
    title: 'Live preview',
    body: 'See your formatted document update in real time as you type.',
  },
  {
    target: 'export',
    title: 'Copy & export',
    body: 'Copy the HTML or Markdown, or download a .md file to take your work anywhere.',
  },
  {
    target: 'reset',
    title: 'Saved automatically',
    body: 'Your document auto-saves on this device. Use ↺ Reset to restore the starter cheatsheet.',
  },
]
