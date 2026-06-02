import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Pomodoro Timer',
    body: "A quick tour of focusing in 25-minute blocks with short and long breaks. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'timer',
    title: 'The timer ring',
    body: 'This shows the time left in the current phase, with the ring emptying as you go.',
  },
  {
    target: 'controls',
    title: 'Start, pause, skip',
    body: 'Press Start to begin focusing and Pause to take a breather. Skip jumps straight to the next phase.',
  },
  {
    target: 'sessions',
    title: 'Track your sessions',
    body: 'These pips fill up as you finish work sessions — four of them earn you a longer break.',
  },
  {
    target: 'reset',
    title: 'Saved automatically',
    body: 'Your progress auto-saves on this device. Use ↺ Reset to clear sessions and start over.',
  },
]
