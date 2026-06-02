import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Age Calculator',
    body: "A quick tour of how to find your exact age and next birthday. It takes about 15 seconds — you can skip anytime.",
  },
  {
    target: 'birthdate',
    title: 'Pick your birthdate',
    body: 'Choose the day you were born. Future dates aren’t allowed, and everything updates the moment you pick.',
  },
  {
    target: 'results',
    title: 'See your stats',
    body: 'Once a date is set, this area fills with your age, days until your next birthday, the day you were born, and total days lived.',
  },
  {
    target: 'reset',
    title: 'Start fresh',
    body: 'Your date auto-saves on this device — tap ↺ Reset here to clear it.',
  },
]
