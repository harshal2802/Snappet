import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the Kanban Board',
    body: "A quick tour of how to organize your tasks into columns and cards. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'board',
    title: 'Your columns',
    body: 'Each column is a stage of work, like To Do, In Progress, and Done. Click a column title to rename it.',
  },
  {
    target: 'add-card',
    title: 'Add a card',
    body: 'Use “+ Add card” to drop a new task into a column. Click any card to edit its details or color.',
  },
  {
    target: 'add-column',
    title: 'Add a column',
    body: 'Need another stage? Add a fresh column here, then drag cards between columns to move work along.',
  },
  {
    target: 'reset',
    title: 'Saved automatically',
    body: 'Your board auto-saves on this device. Use ↺ Reset to clear everything and start fresh.',
  },
]
