import type { WeightUnit } from './types'

interface SettingsViewProps {
  preferredUnit: WeightUnit
  setPreferredUnit: (u: WeightUnit) => void
}

export default function SettingsView({
  preferredUnit,
  setPreferredUnit,
}: SettingsViewProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Settings
      </h2>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Preferred weight unit
        </p>
        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden w-fit">
          {(['kg', 'lb'] as WeightUnit[]).map((u) => {
            const active = preferredUnit === u
            return (
              <button
                key={u}
                onClick={() => setPreferredUnit(u)}
                aria-pressed={active}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
              >
                {u}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Used as the default for new sets across the app. You can override per
          set during a workout.
        </p>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
        More settings coming soon.
      </p>
    </div>
  )
}
