import { Link } from 'react-router-dom'
import type { AppRoute, AppCategory } from '../../router/routes'

const categoryStyles: Record<AppCategory, string> = {
  Utilities: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Calculators: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Productivity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Developer Tools': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Creative: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

interface AppCardProps {
  route: AppRoute
}

export default function AppCard({ route }: AppCardProps) {
  return (
    <Link
      to={route.path}
      className="group flex flex-col items-center text-center p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className="text-4xl mb-3" role="img" aria-label={route.label}>
        {route.icon}
      </span>
      <span className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {route.label}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400 mb-3 leading-snug">
        {route.description}
      </span>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryStyles[route.category]}`}
      >
        {route.category}
      </span>
    </Link>
  )
}
