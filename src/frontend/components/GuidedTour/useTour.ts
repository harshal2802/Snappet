import { useCallback, useEffect, useRef, useState } from 'react'
import type { TourController, TourStep } from './types'

interface UseTourOptions {
  /** Bump when you change a tour's steps so returning users see it again. Default 1. */
  version?: number
  /** Auto-start once on a user's first visit to the tool. Default true. */
  auto?: boolean
}

/**
 * State machine + persistence for a single app's guided tour.
 *
 * Completion is remembered per-device in localStorage under
 * `snappet:tour:<appId>:v<version>` so the tour auto-runs only once. The replay
 * button can re-start it anytime; bumping `version` re-shows it after edits.
 */
export function useTour(
  appId: string,
  steps: TourStep[],
  { version = 1, auto = true }: UseTourOptions = {},
): TourController {
  const storageKey = `snappet:tour:${appId}:v${version}`
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const startedRef = useRef(false)

  const start = useCallback(() => {
    if (!steps.length) return
    setIndex(0)
    setActive(true)
  }, [steps.length])

  const stop = useCallback(
    (completed = false) => {
      setActive(false)
      if (completed) {
        try {
          localStorage.setItem(storageKey, '1')
        } catch {
          // localStorage unavailable (private mode / quota) — tour just re-shows.
        }
      }
    },
    [storageKey],
  )

  const go = useCallback(
    (i: number) => setIndex((cur) => Math.max(0, Math.min(steps.length - 1, i ?? cur))),
    [steps.length],
  )

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        stop(true)
        return i
      }
      return i + 1
    })
  }, [steps.length, stop])

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Auto-start once, after the first paint so targets exist in the DOM.
  useEffect(() => {
    if (!auto || startedRef.current || !steps.length) return
    let seen = false
    try {
      seen = localStorage.getItem(storageKey) === '1'
    } catch {
      seen = false
    }
    if (seen) return
    startedRef.current = true
    const t = window.setTimeout(start, 450)
    return () => window.clearTimeout(t)
  }, [auto, steps.length, storageKey, start])

  return { appId, steps, active, index, start, stop, next, prev, go }
}
