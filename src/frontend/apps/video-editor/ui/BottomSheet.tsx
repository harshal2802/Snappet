import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  // 'medium' peeks ~half height; 'large' is near-full. Content scrolls within.
  size?: 'medium' | 'large'
}

// Mobile bottom sheet: slides up from the bottom, safe-area padded, scrim-dismissable,
// Esc-dismissable, motion-reduce aware. Used for Media library and clip Properties.
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  size = 'medium',
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const maxH = size === 'large' ? '88dvh' : '60dvh'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Scrim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 motion-safe:animate-[fadeIn_150ms_ease-out]"
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[88dvh] flex-col rounded-t-2xl bg-white shadow-2xl motion-safe:animate-[slideUp_200ms_ease-out] dark:bg-gray-900"
        style={{ maxHeight: maxH }}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <span className="mx-auto -ml-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          <h2 className="absolute left-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="z-10 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        <div
          className="overflow-y-auto overscroll-contain px-4 py-3"
          style={{
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
