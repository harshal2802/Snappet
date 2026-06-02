/**
 * Guided-tour types. A tour is an ordered list of steps; each step optionally
 * points at an element via its `data-tour="<target>"` attribute. Steps with no
 * target render as a centered card (great for intro/outro steps).
 */

export interface TourStep {
  /** The `data-tour` value of the element to spotlight. Omit for a centered card. */
  target?: string | null
  /** Short heading shown in the tooltip. */
  title: string
  /** One or two sentences explaining the target. */
  body: string
  /** Preferred side to place the tooltip; falls back automatically if it won't fit. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
}

export interface TourController {
  appId: string
  steps: TourStep[]
  active: boolean
  index: number
  start: () => void
  stop: (completed?: boolean) => void
  next: () => void
  prev: () => void
  go: (i: number) => void
}
