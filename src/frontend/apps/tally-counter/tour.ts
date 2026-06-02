import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Tally Counter',
    body: 'A quick tour of how to count anything with one thumb. It takes about 20 seconds — you can skip anytime.',
  },
  {
    target: 'name',
    title: 'Name your counter',
    body: 'Tap the name to rename it for whatever you are counting.',
  },
  {
    target: 'value',
    title: 'Your current count',
    body: 'The big number shows the active counter total at a glance.',
  },
  {
    target: 'increment',
    title: 'Tap to count',
    body: 'Hit the big button to add one. The minus button below subtracts.',
  },
  {
    target: 'counters',
    title: 'Manage counters',
    body: 'Switch between counters here, or tap “+ New” to track something else.',
  },
]
