import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Unit Converter',
    body: "A quick tour of how to convert between units across seven categories. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'categories',
    title: 'Pick a category',
    body: 'Choose what you’re converting — length, weight, temperature, volume, speed, time, or data.',
  },
  {
    target: 'from',
    title: 'Enter a value',
    body: 'Type the amount and pick its unit here. The result updates live as you type.',
  },
  {
    target: 'swap',
    title: 'Swap directions',
    body: 'Flip the From and To units in one tap when you want to convert the other way.',
  },
  {
    target: 'to',
    title: 'Read the result',
    body: 'The converted value appears here — and you can type into this side too to convert in reverse.',
  },
  {
    target: 'presets',
    title: 'Quick presets',
    body: 'Tap a common pairing to set both units instantly. Your choices auto-save on this device.',
  },
]
