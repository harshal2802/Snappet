import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Random Picker',
    body: 'A quick tour of flipping, rolling, and picking at random. It takes about 20 seconds — you can skip anytime.',
  },
  {
    target: 'tabs',
    title: 'Choose a tool',
    body: 'Switch between a coin, dice, a random number, picking from a list, or shuffling.',
  },
  {
    target: 'result',
    title: 'See your result',
    body: 'Each result appears here, big and clear, as soon as you act.',
  },
  {
    target: 'action',
    title: 'Make it happen',
    body: 'Tap the main button — like “Flip” — to get a fresh random result.',
  },
  {
    target: 'history',
    title: 'Recent results',
    body: 'Your last five results are tucked away here for quick reference.',
  },
]
