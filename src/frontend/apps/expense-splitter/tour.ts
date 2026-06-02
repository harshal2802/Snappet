import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Expense Splitter',
    body: "A quick tour of how to track shared costs and see who owes what. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'people',
    title: 'Add your group',
    body: 'Everyone sharing the costs lives here. Type a name and press Add (or Enter) to grow the list.',
  },
  {
    target: 'add-person',
    title: 'Quick add',
    body: 'Use this box to add a new person — they’re automatically included in every expense.',
  },
  {
    target: 'expenses',
    title: 'Log expenses',
    body: 'Add each bill here. Split it evenly or set custom amounts per person on every card.',
  },
  {
    target: 'add-expense',
    title: 'New expense',
    body: 'Tap here to add another expense whenever someone spends.',
  },
  {
    target: 'summary',
    title: 'See the totals',
    body: 'The breakdown shows what each person owes. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
