import { useState } from 'react'

const PRESET_TIPS = [10, 15, 18, 20, 25] as const
type TipOption = (typeof PRESET_TIPS)[number] | 'custom'
type SplitMode = 'equal' | 'per-person'

interface PersonEntry {
  id: string
  name: string
  amount: string
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function formatCurrency(value: number): string {
  return '$' + value.toFixed(2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const TIP_BTN_BASE =
  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const TIP_BTN_ACTIVE =
  'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
const TIP_BTN_INACTIVE =
  'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

const AMOUNT_INPUT =
  'w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

export default function TipCalculator() {
  // Shared
  const [tipOption, setTipOption] = useState<TipOption>(18)
  const [customTipInput, setCustomTipInput] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')

  // Equal mode
  const [billInput, setBillInput] = useState('')
  const [people, setPeople] = useState(2)

  // Per-person mode
  const [personEntries, setPersonEntries] = useState<PersonEntry[]>([
    { id: generateId(), name: 'Person 1', amount: '' },
    { id: generateId(), name: 'Person 2', amount: '' },
  ])

  const tipPercent: number =
    tipOption === 'custom'
      ? clamp(parseFloat(customTipInput) || 0, 0, 100)
      : tipOption

  // Equal mode calculations
  const bill = parseFloat(billInput) || 0
  const tipTotal = bill * (tipPercent / 100)
  const grandTotal = bill + tipTotal
  const tipPerPerson = people > 0 ? tipTotal / people : 0
  const totalPerPerson = people > 0 ? grandTotal / people : 0

  // Per-person calculations
  const perPersonCalc = personEntries.map((p) => {
    const b = parseFloat(p.amount) || 0
    const t = b * (tipPercent / 100)
    return { id: p.id, name: p.name, bill: b, tip: t, total: b + t }
  })
  const ppTotalBill = perPersonCalc.reduce((s, p) => s + p.bill, 0)
  const ppTotalTip = perPersonCalc.reduce((s, p) => s + p.tip, 0)
  const ppGrandTotal = ppTotalBill + ppTotalTip

  // Mode switch handlers
  function switchToPerPerson() {
    const equalAmount =
      people > 0 && bill > 0
        ? parseFloat((bill / people).toFixed(2)).toString()
        : ''
    setPersonEntries(
      Array.from({ length: people }, (_, i) => ({
        id: generateId(),
        name: `Person ${i + 1}`,
        amount: equalAmount,
      }))
    )
    setSplitMode('per-person')
  }

  function switchToEqual() {
    if (ppTotalBill > 0) setBillInput(ppTotalBill.toFixed(2))
    setPeople(personEntries.length)
    setSplitMode('equal')
  }

  // Tip controls
  function handleCustomTipBlur() {
    const val = parseFloat(customTipInput)
    if (!isNaN(val)) setCustomTipInput(String(clamp(val, 0, 100)))
  }

  // Equal mode people stepper
  function decrement() { setPeople((p) => Math.max(1, p - 1)) }
  function increment() { setPeople((p) => Math.min(50, p + 1)) }
  function handlePeopleInput(value: string) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) setPeople(clamp(parsed, 1, 50))
    else if (value === '') setPeople(1)
  }

  // Per-person entry handlers
  function updateEntry(id: string, field: 'name' | 'amount', value: string) {
    setPersonEntries((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  function addEntry() {
    setPersonEntries((prev) => [
      ...prev,
      { id: generateId(), name: `Person ${prev.length + 1}`, amount: '' },
    ])
  }

  function removeEntry(id: string) {
    if (personEntries.length <= 1) return
    setPersonEntries((prev) => prev.filter((p) => p.id !== id))
  }

  // Tip percentage controls JSX (shared between both modes)
  const tipControls = (
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
            className={`${TIP_BTN_BASE} ${tipOption === tip ? TIP_BTN_ACTIVE : TIP_BTN_INACTIVE}`}
          >
            {tip}%
          </button>
        ))}
        <button
          onClick={() => setTipOption('custom')}
          aria-pressed={tipOption === 'custom'}
          className={`${TIP_BTN_BASE} ${tipOption === 'custom' ? TIP_BTN_ACTIVE : TIP_BTN_INACTIVE}`}
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
  )

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Tip Calculator
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Calculate tip and split the bill among friends.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-fit">
        <button
          onClick={switchToEqual}
          aria-pressed={splitMode === 'equal'}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            splitMode === 'equal'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Equal split
        </button>
        <button
          onClick={switchToPerPerson}
          aria-pressed={splitMode === 'per-person'}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            splitMode === 'per-person'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Per person
        </button>
      </div>

      {/* ── EQUAL MODE ── */}
      {splitMode === 'equal' && (
        <>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-6 shadow-sm">
            {/* Bill amount */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Bill Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billInput}
                  onChange={(e) => setBillInput(e.target.value)}
                  placeholder="0.00"
                  className={AMOUNT_INPUT}
                />
              </div>
            </div>

            {tipControls}

            {/* People stepper */}
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
                >−</button>
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
                >+</button>
              </div>
            </div>
          </div>

          {/* Equal results card */}
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">Tip / person</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(tipPerPerson)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">Total / person</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalPerPerson)}</p>
              </div>
            </div>
            <div className="border-t border-blue-100 dark:border-blue-900" />
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
        </>
      )}

      {/* ── PER PERSON MODE ── */}
      {splitMode === 'per-person' && (
        <>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-6 shadow-sm">
            {/* Person rows */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Bill per person
              </label>
              {personEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateEntry(entry.id, 'name', e.target.value)}
                    placeholder="Name"
                    className="w-28 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.amount}
                      onChange={(e) => updateEntry(entry.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    disabled={personEntries.length <= 1}
                    aria-label={`Remove ${entry.name}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >✕</button>
                </div>
              ))}
              <button
                onClick={addEntry}
                className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                + Add person
              </button>
            </div>

            {tipControls}
          </div>

          {/* Per-person results card */}
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 p-6 space-y-4 shadow-sm">
            {/* Breakdown table */}
            <div className="space-y-2">
              {perPersonCalc.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-200 w-24 truncate">
                    {p.name || '—'}
                  </span>
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Bill</p>
                      <p className="text-gray-700 dark:text-gray-300">{formatCurrency(p.bill)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Tip</p>
                      <p className="text-gray-700 dark:text-gray-300">{formatCurrency(p.tip)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-500 dark:text-blue-400 font-medium">Total</p>
                      <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(p.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-blue-100 dark:border-blue-900" />

            {/* Summary */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Total bill</span>
                <span>{formatCurrency(ppTotalBill)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Total tip ({tipPercent}%)</span>
                <span>{formatCurrency(ppTotalTip)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 dark:text-gray-100">
                <span>Grand total</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(ppGrandTotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
