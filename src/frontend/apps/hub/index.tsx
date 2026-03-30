import { useState, useRef } from 'react'
import { routes } from '../../router/routes'
import type { AppCategory } from '../../router/routes'
import AppCard from './AppCard'

const ALL = 'All' as const
type Filter = typeof ALL | AppCategory

const CATEGORIES: AppCategory[] = [
  'Utilities',
  'Calculators',
  'Productivity',
  'Developer Tools',
  'Creative',
]

const categoryChipStyles: Record<AppCategory, string> = {
  Utilities: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Calculators: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
  Productivity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  'Developer Tools': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  Creative: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border-pink-200 dark:border-pink-800',
}

export default function HubPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Filter>(ALL)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [displayQuery, setDisplayQuery] = useState('')

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 150)
    setDisplayQuery(value)
  }

  const filtered = routes.filter((route) => {
    const matchesCategory =
      activeCategory === ALL || route.category === activeCategory
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === '' ||
      route.label.toLowerCase().includes(q) ||
      route.description.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center pt-6 pb-2">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-3">
          Snappet
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Fast, focused tools for everyday tasks
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Search */}
        <input
          type="search"
          value={displayQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search tools…"
          aria-label="Search tools"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />

        {/* Category chips */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button
            onClick={() => setActiveCategory(ALL)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveCategory(ALL)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeCategory === ALL
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                activeCategory === cat
                  ? categoryChipStyles[cat]
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Result count */}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Showing {filtered.length} of {routes.length} tool{routes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((route) => (
            <AppCard key={route.path} route={route} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 space-y-2">
          <p className="text-4xl">🔍</p>
          <p className="text-gray-500 dark:text-gray-400">
            No tools found. Try a different search.
          </p>
        </div>
      )}
    </div>
  )
}
