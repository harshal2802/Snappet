import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Tip Calculator',
    body: "A quick tour of how to work out the tip and split a bill. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'mode',
    title: 'Pick a split mode',
    body: 'Split the bill evenly with “Equal split”, or enter what each person spent with “Per person”.',
  },
  {
    target: 'bill',
    title: 'Enter the bill',
    body: 'Type the total here. Every number below updates live as you type.',
  },
  {
    target: 'tip',
    title: 'Choose a tip',
    body: 'Tap a preset percentage, or hit “Custom” to enter your own.',
  },
  {
    target: 'people',
    title: 'Set the group size',
    body: 'Use − / + (or type a number) to split across everyone at the table.',
  },
  {
    target: 'results',
    title: 'Read the results',
    body: 'Tip and total per person, plus the grand total. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
