import type { Capabilities } from './caps'

interface Props {
  caps: Capabilities
}

interface Requirement {
  label: string
  ok: boolean
  hint: string
}

export default function UnsupportedBrowser({ caps }: Props) {
  const requirements: Requirement[] = [
    {
      label: 'WebCodecs · VideoDecoder',
      ok: caps.videoDecoder,
      hint: 'Decodes input video frame-by-frame.',
    },
    {
      label: 'WebCodecs · VideoEncoder',
      ok: caps.videoEncoder,
      hint: 'Encodes the final exported MP4.',
    },
    {
      label: 'Origin Private File System (OPFS)',
      ok: caps.opfs,
      hint: 'Stores edit-quality proxies on-device.',
    },
    {
      label: 'Web Workers',
      ok: caps.worker,
      hint: 'Runs encode/decode off the main thread.',
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Video Editor
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          This browser is missing one or more APIs the editor needs. Everything runs
          on your device — there's no server to fall back to.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          What's needed
        </h2>
        <ul className="space-y-3">
          {requirements.map((r) => (
            <li key={r.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className={
                  'mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                  (r.ok
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300')
                }
              >
                {r.ok ? '✓' : '✗'}
              </span>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {r.label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {r.hint}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/40">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Try a supported browser
        </h2>
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>· Chrome / Edge 94 or newer (recommended)</li>
          <li>· Safari 17 or newer (macOS Sonoma · iOS 17+)</li>
          <li>· Firefox 130 or newer (October 2024 or later)</li>
        </ul>
      </section>
    </div>
  )
}
