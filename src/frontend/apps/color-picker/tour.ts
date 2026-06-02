import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Color Picker',
    body: "A quick tour of how to pick a color and convert between formats. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'picker',
    title: 'Pick a color',
    body: 'Tap the swatch to open your system color picker, or just paste a value into one of the fields.',
  },
  {
    target: 'formats',
    title: 'HEX, RGB & HSL',
    body: 'Edit any format and the others update instantly. Hit Copy to grab a value for your code.',
  },
  {
    target: 'preview',
    title: 'Check contrast',
    body: 'See your color in action with live WCAG contrast ratios against white and black. Your color auto-saves — use ↺ Reset to start over.',
  },
]
