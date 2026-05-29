import { useEffect } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Styled, accessible replacement for window.confirm. Centered card that sits low
// enough to stay thumb-reachable on phones.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center">
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl motion-safe:animate-[slideUp_180ms_ease-out] dark:bg-gray-800 sm:motion-safe:animate-[fadeIn_150ms_ease-out]"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="flex h-11 items-center rounded-lg px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={
              'flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-white ' +
              (destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700')
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
