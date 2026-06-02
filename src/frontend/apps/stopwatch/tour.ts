import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Stopwatch',
    body: "A quick tour of timing anything with lap splits. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'display',
    title: 'The time display',
    body: 'This counts up while running, showing minutes, seconds, and centiseconds (hours appear once you pass an hour).',
  },
  {
    target: 'controls',
    title: 'Start, lap, stop',
    body: 'Press Start to begin. While running you can record a Lap split or Stop to pause; from paused you can Resume or Reset.',
  },
  {
    target: 'header',
    title: 'Saved automatically',
    body: 'Your time and laps auto-save on this device, so a refresh won’t lose your run. Reset clears everything once paused.',
  },
]
