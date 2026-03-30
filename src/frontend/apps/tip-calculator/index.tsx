import { useState } from 'react'

const PRESET_TIPS = [10, 15, 18, 20, 25] as const

type TipOption = (typeof PRESET_TIPS)[number] | 'custom'

function formatCurrency(value: number): string {
  return '$' + value.toFixed(2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function TipCalculator() {
  const [billInput, setBillInput] = useState('')
  const [tipOption, setTipOption] = useState<TipOption>(18)
  const [customTipInput, setCustomTipInput] = useState('')
  const [people, setPeople] = useState(2)

  const bill = parseFloat(billInput) || 0

  const tipPercent: number =
    tipOption === 'custom'
      ? clamp(parseFloat(customTipInput) || 0, 0, 100)
      : tipOption

  const tipTotal = bill * (tipPercent / 100)
  const grandTotal = bill + tipTotal
  const tipPerPerson = people > 0 ? tipTotal / people : 0
  const totalPerPerson = people > 0 ? grandTotal / people : 0

  function handleCustomTipBlur() {
    const val = parseFloat(customTipInput)
    if (!isNaN(val)) {
      setCustomTipInput(String(clamp(val, 0, 100)))
    }
  }

  function decrement() {
    setPeople((p) => Math.max(1, p - 1))
  }

  function increment() {
    setPeople((p) => Math.min(50, p + 1))
  }

  function handlePeopleInput(value: string) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) setPeople(clamp(parsed, 1, 50))
    else if (value === '') setPeople(1)
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Tip Calculator
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Calculate tip and split the bill among friends.
        </p>
      </div>

      {/* Inputs card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-6 shadow-sm">

        {/* Bill amount */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bill Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={billInput}
              onChange={(e) => setBillInput(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Tip percentage */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tip Percentage
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_TIPS.map((tip) => (
              <button
                key={tip}
                onClick={() => setTipOption(tip)}
                aria-pressed={tipOption === tip}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  tipOption === tip
                    ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                {tip}%
              </button>
            ))}
            <button
              onClick={() => setTipOption('custom')}
              aria-pressed={tipOption === 'custom'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                tipOption === 'custom'
                  ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
              }`}
            >
              Custom
            </button>
          </div>
          {tipOption === 'custom' && (
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={customTipInput}
                onChange={(e) => setCustomTipInput(e.target.value)}
                onBlur={handleCustomTipBlur}
                placeholder="Enter %"
                autoFocus
                className="w-32 pr-7 pl-3 py-2 rounded-lg border border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">
                %
              </span>
            </div>
          )}
        </div>

        {/* Number of people */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Number of People
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={decrement}
              disabled={people === 1}
              aria-label="Remove one person"
              className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-lg flex items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              max="50"
              value={people}
              onChange={(e) => handlePeopleInput(e.target.value)}
              className="w-16 text-center py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <button
              onClick={increment}
              disabled={people === 50}
              aria-label="Add one person"
              className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-lg flex items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Results card */}
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 p-6 space-y-4 shadow-sm">

        {/* Per-person highlight */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">
              Tip / person
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(tipPerPerson)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">
              Total / person
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalPerPerson)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-blue-100 dark:border-blue-900" />

        {/* Subtotals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Tip total ({tipPercent}%)</span>
            <span>{formatCurrency(tipTotal)}</span>
          </div>
          <div className="flex justify-between font-medium text-gray-700 dark:text-gray-300">
            <span>Grand total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
