import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.error('SW registration error:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-xl border border-gray-700 dark:border-gray-300 max-w-[calc(100vw-2rem)]"
    >
      <span className="text-sm">A new version of Snappet is available.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-200 dark:hover:text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
      >
        ✕
      </button>
    </div>
  )
}
