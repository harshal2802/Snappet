import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDarkMode } from '../hooks/useDarkMode'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isDark, toggle } = useDarkMode()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-700">
        <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="font-bold text-lg hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Snappet
          </Link>
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="rounded-md px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-500 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>Snappet</span>
          <span aria-hidden="true">·</span>
          {/* Static page outside the SPA — use a full anchor with the base path. */}
          <a
            href={`${import.meta.env.BASE_URL}knowledge-graph/`}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Knowledge graph
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/harshal2802/Snappet"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://www.linkedin.com/in/harshal-chourasiya-39bb0426"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  )
}
