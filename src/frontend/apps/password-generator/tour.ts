import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Password Generator',
    body: "A quick tour of how to create strong, secure passwords. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'password',
    title: 'Your password',
    body: 'A fresh password generated with cryptographically secure randomness appears right here.',
  },
  {
    target: 'actions',
    title: 'Copy or regenerate',
    body: 'Copy it to your clipboard, or hit Regenerate to roll a brand-new one.',
  },
  {
    target: 'strength',
    title: 'Check the strength',
    body: 'The bar shows estimated entropy in bits — aim for Strong or Very Strong.',
  },
  {
    target: 'length',
    title: 'Set the length',
    body: 'Drag the slider between 8 and 64 characters. Longer is stronger.',
  },
  {
    target: 'charsets',
    title: 'Pick character sets',
    body: 'Mix in uppercase, lowercase, numbers, and symbols. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
