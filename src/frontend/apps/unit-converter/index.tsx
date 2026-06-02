import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'

// ── Types ───────────────────────────────────────────────────────────────────

type Category =
  | 'length'
  | 'weight'
  | 'temperature'
  | 'volume'
  | 'speed'
  | 'time'
  | 'data'

interface LinearUnit {
  label: string
  symbol: string
  toBase: number // multiply value by toBase to get value in base unit
}

interface TempUnit {
  label: string
  symbol: string
  toCelsius: (v: number) => number
  fromCelsius: (v: number) => number
}

type Unit = LinearUnit | TempUnit

interface CategoryDef {
  label: string
  units: Record<string, Unit>
  presets: Array<{ from: string; to: string }>
  defaultFrom: string
  defaultTo: string
}

// ── Conversion tables ───────────────────────────────────────────────────────

const LENGTH: Record<string, LinearUnit> = {
  m: { label: 'Meters', symbol: 'm', toBase: 1 },
  km: { label: 'Kilometers', symbol: 'km', toBase: 1000 },
  cm: { label: 'Centimeters', symbol: 'cm', toBase: 0.01 },
  mm: { label: 'Millimeters', symbol: 'mm', toBase: 0.001 },
  mi: { label: 'Miles', symbol: 'mi', toBase: 1609.344 },
  yd: { label: 'Yards', symbol: 'yd', toBase: 0.9144 },
  ft: { label: 'Feet', symbol: 'ft', toBase: 0.3048 },
  in: { label: 'Inches', symbol: 'in', toBase: 0.0254 },
}

const WEIGHT: Record<string, LinearUnit> = {
  g: { label: 'Grams', symbol: 'g', toBase: 1 },
  kg: { label: 'Kilograms', symbol: 'kg', toBase: 1000 },
  mg: { label: 'Milligrams', symbol: 'mg', toBase: 0.001 },
  lb: { label: 'Pounds', symbol: 'lb', toBase: 453.59237 },
  oz: { label: 'Ounces', symbol: 'oz', toBase: 28.349523125 },
}

const TEMPERATURE: Record<string, TempUnit> = {
  C: {
    label: 'Celsius',
    symbol: '°C',
    toCelsius: (v) => v,
    fromCelsius: (v) => v,
  },
  F: {
    label: 'Fahrenheit',
    symbol: '°F',
    toCelsius: (v) => ((v - 32) * 5) / 9,
    fromCelsius: (v) => (v * 9) / 5 + 32,
  },
  K: {
    label: 'Kelvin',
    symbol: 'K',
    toCelsius: (v) => v - 273.15,
    fromCelsius: (v) => v + 273.15,
  },
}

// US fluid units; 1 cup = 240 mL per spec (metric cup), as the research notes.
const VOLUME: Record<string, LinearUnit> = {
  L: { label: 'Liters', symbol: 'L', toBase: 1 },
  mL: { label: 'Milliliters', symbol: 'mL', toBase: 0.001 },
  gal: { label: 'Gallons (US)', symbol: 'gal', toBase: 3.785411784 },
  qt: { label: 'Quarts (US)', symbol: 'qt', toBase: 0.946352946 },
  pt: { label: 'Pints (US)', symbol: 'pt', toBase: 0.473176473 },
  cup: { label: 'Cups (240 mL)', symbol: 'cup', toBase: 0.24 },
  flOz: { label: 'Fluid Ounces (US)', symbol: 'fl oz', toBase: 0.0295735295625 },
  tbsp: { label: 'Tablespoons (US)', symbol: 'tbsp', toBase: 0.01478676478125 },
  tsp: { label: 'Teaspoons (US)', symbol: 'tsp', toBase: 0.00492892159375 },
}

const SPEED: Record<string, LinearUnit> = {
  'm/s': { label: 'Meters / second', symbol: 'm/s', toBase: 1 },
  'km/h': { label: 'Kilometers / hour', symbol: 'km/h', toBase: 1 / 3.6 },
  mph: { label: 'Miles / hour', symbol: 'mph', toBase: 0.44704 },
  knot: { label: 'Knots', symbol: 'kn', toBase: 0.514444444444 },
}

const TIME: Record<string, LinearUnit> = {
  s: { label: 'Seconds', symbol: 's', toBase: 1 },
  min: { label: 'Minutes', symbol: 'min', toBase: 60 },
  hr: { label: 'Hours', symbol: 'hr', toBase: 3600 },
  day: { label: 'Days', symbol: 'day', toBase: 86400 },
  week: { label: 'Weeks', symbol: 'wk', toBase: 604800 },
}

// Decimal (powers of 1000) vs binary (powers of 1024) clearly labeled.
const DATA: Record<string, LinearUnit> = {
  B: { label: 'Bytes', symbol: 'B', toBase: 1 },
  KB: { label: 'Kilobytes (1000)', symbol: 'KB', toBase: 1e3 },
  MB: { label: 'Megabytes (1000²)', symbol: 'MB', toBase: 1e6 },
  GB: { label: 'Gigabytes (1000³)', symbol: 'GB', toBase: 1e9 },
  TB: { label: 'Terabytes (1000⁴)', symbol: 'TB', toBase: 1e12 },
  KiB: { label: 'Kibibytes (1024)', symbol: 'KiB', toBase: 1024 },
  MiB: { label: 'Mebibytes (1024²)', symbol: 'MiB', toBase: 1024 ** 2 },
  GiB: { label: 'Gibibytes (1024³)', symbol: 'GiB', toBase: 1024 ** 3 },
  TiB: { label: 'Tebibytes (1024⁴)', symbol: 'TiB', toBase: 1024 ** 4 },
}

const CATEGORIES: Record<Category, CategoryDef> = {
  length: {
    label: 'Length',
    units: LENGTH,
    presets: [
      { from: 'km', to: 'mi' },
      { from: 'cm', to: 'in' },
      { from: 'm', to: 'ft' },
    ],
    defaultFrom: 'km',
    defaultTo: 'mi',
  },
  weight: {
    label: 'Weight',
    units: WEIGHT,
    presets: [
      { from: 'kg', to: 'lb' },
      { from: 'g', to: 'oz' },
    ],
    defaultFrom: 'kg',
    defaultTo: 'lb',
  },
  temperature: {
    label: 'Temperature',
    units: TEMPERATURE,
    presets: [
      { from: 'C', to: 'F' },
      { from: 'C', to: 'K' },
    ],
    defaultFrom: 'C',
    defaultTo: 'F',
  },
  volume: {
    label: 'Volume',
    units: VOLUME,
    presets: [
      { from: 'cup', to: 'mL' },
      { from: 'L', to: 'gal' },
      { from: 'tbsp', to: 'mL' },
    ],
    defaultFrom: 'cup',
    defaultTo: 'mL',
  },
  speed: {
    label: 'Speed',
    units: SPEED,
    presets: [
      { from: 'km/h', to: 'mph' },
      { from: 'm/s', to: 'km/h' },
    ],
    defaultFrom: 'km/h',
    defaultTo: 'mph',
  },
  time: {
    label: 'Time',
    units: TIME,
    presets: [
      { from: 'hr', to: 'min' },
      { from: 'day', to: 'hr' },
      { from: 'week', to: 'day' },
    ],
    defaultFrom: 'hr',
    defaultTo: 'min',
  },
  data: {
    label: 'Data',
    units: DATA,
    presets: [
      { from: 'KB', to: 'KiB' },
      { from: 'MB', to: 'MiB' },
      { from: 'GiB', to: 'GB' },
    ],
    defaultFrom: 'MB',
    defaultTo: 'MiB',
  },
}

const CATEGORY_ORDER: Category[] = [
  'length',
  'weight',
  'temperature',
  'volume',
  'speed',
  'time',
  'data',
]

// ── Conversion logic ────────────────────────────────────────────────────────

function isTempUnit(u: Unit): u is TempUnit {
  return 'toCelsius' in u
}

/**
 * Pure conversion. Linear units use the base-factor table; temperature uses
 * explicit fromCelsius/toCelsius functions.
 */
function convert(
  value: number,
  from: Unit,
  to: Unit,
  category: Category,
): number {
  if (category === 'temperature') {
    if (!isTempUnit(from) || !isTempUnit(to)) return NaN
    return to.fromCelsius(from.toCelsius(value))
  }
  if (isTempUnit(from) || isTempUnit(to)) return NaN
  return (value * from.toBase) / to.toBase
}

// ── Number formatting ──────────────────────────────────────────────────────

const SIG_DIGITS = 6

/**
 * Format a number for display: up to 6 significant digits, strip trailing
 * zeros, use locale separators for whole numbers.
 */
function formatNumber(n: number): string {
  if (!isFinite(n)) return ''
  if (n === 0) return '0'
  // Whole numbers within a reasonable range — use locale separators.
  if (Number.isInteger(n) && Math.abs(n) < 1e15) {
    return n.toLocaleString()
  }
  // toPrecision gives us significant-digit control, then strip trailing zeros.
  const precise = n.toPrecision(SIG_DIGITS)
  // Re-parse to drop trailing zeros (e.g. "1.50000" → "1.5"), then if it ended
  // up an integer after rounding, format it with locale separators.
  const parsed = Number(precise)
  if (Number.isInteger(parsed) && Math.abs(parsed) < 1e15) {
    return parsed.toLocaleString()
  }
  // Strip trailing zeros from decimal portion.
  let s = precise
  if (s.includes('.') && !s.includes('e') && !s.includes('E')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  return s
}

// ── Styles ──────────────────────────────────────────────────────────────────

const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm'

const INPUT =
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

const SELECT =
  'px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

const PILL_BASE =
  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const PILL_ACTIVE =
  'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
const PILL_INACTIVE =
  'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

const PRESET_CHIP =
  'px-2.5 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

// ── Component ───────────────────────────────────────────────────────────────

export default function UnitConverter() {
  const [category, setCategory] = useLocalStorage<Category>(
    'snappet:unit-converter:category',
    'length',
  )

  const def = CATEGORIES[category]

  // Per-category persistence for unit selections. We use a single record so
  // switching categories restores the user's previous unit choice.
  const [fromUnits, setFromUnits] = useLocalStorage<Record<Category, string>>(
    'snappet:unit-converter:fromUnits',
    {
      length: CATEGORIES.length.defaultFrom,
      weight: CATEGORIES.weight.defaultFrom,
      temperature: CATEGORIES.temperature.defaultFrom,
      volume: CATEGORIES.volume.defaultFrom,
      speed: CATEGORIES.speed.defaultFrom,
      time: CATEGORIES.time.defaultFrom,
      data: CATEGORIES.data.defaultFrom,
    },
  )
  const [toUnits, setToUnits] = useLocalStorage<Record<Category, string>>(
    'snappet:unit-converter:toUnits',
    {
      length: CATEGORIES.length.defaultTo,
      weight: CATEGORIES.weight.defaultTo,
      temperature: CATEGORIES.temperature.defaultTo,
      volume: CATEGORIES.volume.defaultTo,
      speed: CATEGORIES.speed.defaultTo,
      time: CATEGORIES.time.defaultTo,
      data: CATEGORIES.data.defaultTo,
    },
  )

  // Guard: if a persisted unit key no longer exists in the category (e.g. table
  // changed across versions), fall back to the default for that category.
  const fromKey = def.units[fromUnits[category]]
    ? fromUnits[category]
    : def.defaultFrom
  const toKey = def.units[toUnits[category]]
    ? toUnits[category]
    : def.defaultTo

  // The persisted input value lives as a string so we keep what the user typed
  // (avoids re-rendering "1" as "1.00000…" mid-typing).
  const [fromValue, setFromValue] = useLocalStorage<string>(
    'snappet:unit-converter:fromValue',
    '1',
  )
  const [toValue, setToValue] = useState<string>('')

  // Tracks which input the user is currently driving; we re-derive the other.
  const lastEdited = useRef<'from' | 'to'>('from')

  const fromUnit = def.units[fromKey]
  const toUnit = def.units[toKey]

  // Recompute the *other* side whenever inputs or units change.
  //
  // The `lastEdited` ref tells us which side is the source of truth. We use it
  // in the effect body (not as a dep) and gate which value we listen to. Both
  // fromValue and toValue are in the dep array so the effect runs on either
  // keystroke; the body picks the right direction and only writes the
  // *opposite* side, so there's no feedback loop.
  useEffect(() => {
    if (lastEdited.current === 'from') {
      const num = parseFloat(fromValue)
      if (fromValue === '' || isNaN(num)) {
        setToValue('')
        return
      }
      const result = convert(num, fromUnit, toUnit, category)
      setToValue(formatNumber(result))
    } else {
      const num = parseFloat(toValue)
      if (toValue === '' || isNaN(num)) {
        setFromValue('')
        return
      }
      const result = convert(num, toUnit, fromUnit, category)
      setFromValue(formatNumber(result))
    }
  }, [category, fromKey, toKey, fromValue, toValue, fromUnit, toUnit])

  function handleCategoryChange(next: Category) {
    lastEdited.current = 'from'
    setCategory(next)
  }

  function handleFromUnitChange(next: string) {
    lastEdited.current = 'from'
    setFromUnits((prev) => ({ ...prev, [category]: next }))
  }

  function handleToUnitChange(next: string) {
    lastEdited.current = 'from'
    setToUnits((prev) => ({ ...prev, [category]: next }))
  }

  function handleFromInput(value: string) {
    lastEdited.current = 'from'
    setFromValue(value)
  }

  function handleToInput(value: string) {
    lastEdited.current = 'to'
    setToValue(value)
  }

  function handleSwap() {
    lastEdited.current = 'from'
    setFromUnits((prev) => ({ ...prev, [category]: toKey }))
    setToUnits((prev) => ({ ...prev, [category]: fromKey }))
    // Move what was displayed in the "to" side into the "from" side so the
    // visible numbers swap along with the units.
    setFromValue(toValue)
  }

  function handlePreset(presetFrom: string, presetTo: string) {
    lastEdited.current = 'from'
    setFromUnits((prev) => ({ ...prev, [category]: presetFrom }))
    setToUnits((prev) => ({ ...prev, [category]: presetTo }))
  }

  const unitEntries = useMemo(
    () => Object.entries(def.units),
    [def.units],
  )

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Unit Converter
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Convert length, weight, temperature, volume, speed, time, and data.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="unit-converter" steps={tourSteps} />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Category" data-tour="categories">
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => handleCategoryChange(c)}
            className={`${PILL_BASE} ${category === c ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            {CATEGORIES[c].label}
          </button>
        ))}
      </div>

      {/* Converter card */}
      <div className={`${CARD} space-y-3`}>
        {/* From row */}
        <div className="space-y-1.5" data-tour="from">
          <label
            htmlFor="from-input"
            className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            From
          </label>
          <div className="flex gap-2">
            <input
              id="from-input"
              type="text"
              inputMode="decimal"
              value={fromValue}
              onChange={(e) => handleFromInput(e.target.value)}
              placeholder="0"
              spellCheck={false}
              className={INPUT}
            />
            <select
              aria-label="From unit"
              value={fromKey}
              onChange={(e) => handleFromUnitChange(e.target.value)}
              className={SELECT}
            >
              {unitEntries.map(([key, u]) => (
                <option key={key} value={key}>
                  {u.symbol} — {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center" data-tour="swap">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap units"
            className="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 flex items-center justify-center text-lg"
          >
            ↕
          </button>
        </div>

        {/* To row */}
        <div className="space-y-1.5" data-tour="to">
          <label
            htmlFor="to-input"
            className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            To
          </label>
          <div className="flex gap-2">
            <input
              id="to-input"
              type="text"
              inputMode="decimal"
              value={toValue}
              onChange={(e) => handleToInput(e.target.value)}
              placeholder="0"
              spellCheck={false}
              className={INPUT}
            />
            <select
              aria-label="To unit"
              value={toKey}
              onChange={(e) => handleToUnitChange(e.target.value)}
              className={SELECT}
            >
              {unitEntries.map(([key, u]) => (
                <option key={key} value={key}>
                  {u.symbol} — {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick presets */}
      <div className="space-y-2" data-tour="presets">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Quick presets
        </p>
        <div className="flex flex-wrap gap-2">
          {def.presets.map((p) => {
            const fu = def.units[p.from]
            const tu = def.units[p.to]
            if (!fu || !tu) return null
            return (
              <button
                key={`${p.from}-${p.to}`}
                type="button"
                onClick={() => handlePreset(p.from, p.to)}
                className={PRESET_CHIP}
              >
                {fu.symbol} ↔ {tu.symbol}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
