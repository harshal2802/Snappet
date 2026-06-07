import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to Board Explorer',
    body: 'Browse and filter the climb catalogue of Aurora boards (Kilter, Tension, …) and download a filtered slice — all in your browser. A quick 20-second tour; skip anytime.',
  },
  {
    target: 'board',
    title: 'Pick a board',
    body: 'Choose which board catalogue to explore. The data loads and runs entirely on your device.',
  },
  {
    target: 'filters',
    title: 'Filter the climbs',
    body: 'Narrow by angle, grade range, popularity, quality, setter, name, and more. Results update live.',
  },
  {
    target: 'results',
    title: 'Browse the results',
    body: 'Sortable, paged results show the match count. Each row is a climb at its most-climbed matching angle — click any row to see it drawn on the board.',
  },
  {
    target: 'export',
    title: 'Download your selection',
    body: 'Export the filtered set as CSV, JSON, or a SQLite .db. The Kilter .db imports straight into the Snappet mobile app.',
  },
]
