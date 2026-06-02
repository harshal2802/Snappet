import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTour } from './useTour'
import type { TourController, TourStep } from './types'

interface GuidedTourProps {
  appId: string
  steps: TourStep[]
  /** Bump when you edit the steps so returning users see the tour again. */
  version?: number
  /** Auto-run once on first visit. Default true. */
  auto?: boolean
  /** Extra classes for the inline launch button (e.g. to space it from Reset). */
  className?: string
}

const TIP_W = 340
const PAD = 8

/**
 * Drop-in guided tour. Renders an inline "?" launch button (styled to match the
 * apps' Reset button) plus a portaled spotlight overlay. Self-manages auto-start
 * and per-device "seen" persistence via useTour.
 *
 * Targets are matched by a `data-tour="<id>"` attribute on the element.
 */
export default function GuidedTour({ appId, steps, version, auto, className = '' }: GuidedTourProps) {
  const tour = useTour(appId, steps, { version, auto })

  return (
    <>
      <button
        type="button"
        onClick={tour.start}
        aria-label="Take a guided tour"
        title="Take a guided tour"
        className={
          'px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border ' +
          'border-gray-300 dark:border-gray-600 hover:text-blue-600 dark:hover:text-blue-400 ' +
          'hover:border-blue-300 dark:hover:border-blue-600 transition-colors focus:outline-none ' +
          'focus-visible:ring-2 focus-visible:ring-blue-500 ' +
          className
        }
      >
        ? Tour
      </button>
      {tour.active && <TourOverlay tour={tour} />}
    </>
  )
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function TourOverlay({ tour }: { tour: TourController }) {
  const { steps, index } = tour
  const step = steps[index]
  const [spot, setSpot] = useState<Box | null>(null)
  const [tip, setTip] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const tipRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Recompute spotlight + tooltip position. `scroll` brings the target into view
  // (only on step change, never on passive resize/scroll handling).
  const recompute = (scroll: boolean) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tipW = Math.min(TIP_W, vw - 24)
    const tipH = tipRef.current?.offsetHeight ?? 170
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null

    if (!el) {
      setSpot(null)
      setTip({ top: Math.max(16, (vh - tipH) / 2), left: (vw - tipW) / 2 })
      return
    }
    if (scroll) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
    const r = el.getBoundingClientRect()
    setSpot({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })

    // Mobile: dock the tooltip to the bottom for predictable placement.
    if (vw < 640) {
      setTip({ top: vh - tipH - 16, left: (vw - tipW) / 2 })
      return
    }
    const below = r.bottom + 12
    const above = r.top - tipH - 12
    const top = below + tipH + 12 <= vh ? below : above >= 8 ? above : below
    const left = Math.max(12, Math.min(vw - tipW - 12, r.left + r.width / 2 - tipW / 2))
    setTip({ top, left })
  }

  // Reposition on step change, then once more after the tooltip has measured.
  useLayoutEffect(() => {
    recompute(true)
    const raf = requestAnimationFrame(() => recompute(false))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Keep aligned while the page scrolls or resizes; focus the primary action.
  useEffect(() => {
    const onMove = () => recompute(false)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    nextRef.current?.focus()
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tour.stop(false)
      else if (e.key === 'ArrowRight' || e.key === 'Enter') tour.next()
      else if (e.key === 'ArrowLeft') tour.prev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tour])

  const tipW = Math.min(TIP_W, window.innerWidth - 24)
  const isLast = index === steps.length - 1
  const isFirst = index === 0

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 9999 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Guided tour: ${step.title}`}
    >
      {/* Dimmer + spotlight. The box-shadow on the cutout dims everything else. */}
      {spot ? (
        <div
          className="absolute rounded-lg transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
            outline: '2px solid rgba(59, 130, 246, 0.9)',
            outlineOffset: '2px',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(15, 23, 42, 0.62)' }} />
      )}

      {/* Tooltip card */}
      <div
        ref={tipRef}
        className="absolute rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl p-4 transition-all duration-200 motion-reduce:transition-none"
        style={{ top: tip.top, left: tip.left, width: tipW }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Step {index + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={() => tour.stop(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Skip tour"
          >
            Skip ✕
          </button>
        </div>

        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{step.body}</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  'h-1.5 rounded-full transition-all ' +
                  (i === index
                    ? 'w-4 bg-blue-600 dark:bg-blue-400'
                    : 'w-1.5 bg-gray-300 dark:bg-gray-600')
                }
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={tour.prev}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={tour.next}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
