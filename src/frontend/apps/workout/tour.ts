import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to Workout',
    body: 'A quick tour of tracking your training. It takes about 20 seconds — you can skip anytime.',
  },
  {
    target: 'header',
    title: 'Your training hub',
    body: 'Browse hundreds of exercises and build routines, all saved on this device.',
  },
  {
    target: 'tabs',
    title: 'Move around',
    body: 'These tabs switch between your dashboard, the exercise library, routines, history, and settings.',
  },
  {
    target: 'dashboard-body',
    title: 'Your dashboard',
    body: 'See your weekly snapshot, consistency, volume, and recent personal records at a glance.',
  },
  {
    target: 'browse-tab',
    title: 'Find exercises',
    body: 'Open Browse to search 800+ exercises and check the right form for each one.',
  },
  {
    target: 'routines-tab',
    title: 'Build routines',
    body: 'Head to Routines to start a workout or create your own from scratch.',
  },
]
