import { useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

/* ── Types ── */

type TabKey = 'coin' | 'dice' | 'number' | 'pick' | 'shuffle'

type DieSides = 4 | 6 | 8 | 10 | 12 | 20

interface DiceSettings {
  count: number
  sides: DieSides
}

interface NumberSettings {
  min: number
  max: number
}

type CoinResult = 'Heads' | 'Tails'

interface DiceResult {
  rolls: number[]
  total: number
  sides: DieSides
}

interface NumberResult {
  value: number
  min: number
  max: number
}

interface PickResult {
  value: string
}

interface ShuffleResult {
  items: string[]
}

/* ── Tailwind class constants ── */

const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm'

const TAB_BASE =
  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 select-none'

const TAB_ACTIVE =
  'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'

const TAB_INACTIVE =
  'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

const PRIMARY_BTN =
  'w-full h-14 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white text-base font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 select-none'

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

const SELECT = INPUT + ' appearance-none cursor-pointer'

const LABEL =
  'block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1'

/* ── Defaults ── */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'coin', label: 'Coin' },
  { key: 'dice', label: 'Dice' },
  { key: 'number', label: 'Number' },
  { key: 'pick', label: 'Pick' },
  { key: 'shuffle', label: 'Shuffle' },
]

const DICE_SIDES: DieSides[] = [4, 6, 8, 10, 12, 20]

const DEFAULT_DICE: DiceSettings = { count: 2, sides: 6 }
const DEFAULT_NUMBER: NumberSettings = { min: 1, max: 100 }
const DEFAULT_PICK_ITEMS = 'Pizza\nSushi\nBurgers\nTacos\nSalad'
const DEFAULT_SHUFFLE_ITEMS = 'Alice\nBob\nCarol\nDave\nEve'

const MAX_HISTORY = 5

/* ── Randomness ── */

// Modulo bias is negligible here: a 32-bit source (~4.29B values) vs at most a
// few hundred outcomes — worst-case bias is < 1 part in ~10 million. Acceptable.
function secureRandomInt(min: number, max: number): number {
  if (max < min) [min, max] = [max, min]
  const range = max - min + 1
  const buf = new Uint32Array(1)
  window.crypto.getRandomValues(buf)
  return min + (buf[0] % range)
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function haptic(): void {
  navigator.vibrate?.(10)
}

function splitItems(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/* ── Tab control ── */

interface TabsProps {
  active: TabKey
  onChange: (next: TabKey) => void
}

function Tabs({ active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          aria-pressed={active === t.key}
          className={`${TAB_BASE} ${active === t.key ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ── History footer (collapsible) ── */

interface HistoryProps {
  items: string[]
}

function History({ items }: HistoryProps) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        No history yet — your last 5 results will appear here.
      </p>
    )
  }
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between w-full text-left px-2 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span>History · last {Math.min(items.length, MAX_HISTORY)}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-1 px-2">
          {items.map((entry, idx) => (
            <li
              key={idx}
              className="text-sm font-mono tabular-nums text-gray-700 dark:text-gray-300"
            >
              <span className="text-gray-400 dark:text-gray-500 mr-2">
                {idx + 1}.
              </span>
              {entry}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ── Coin tab ── */

function CoinTab() {
  const [result, setResult] = useState<CoinResult | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  function flip() {
    haptic()
    setSpinning(true)
    const next: CoinResult = secureRandomInt(0, 1) === 0 ? 'Heads' : 'Tails'
    window.setTimeout(() => {
      setResult(next)
      setSpinning(false)
      setHistory((prev) => [next, ...prev].slice(0, MAX_HISTORY))
    }, 300)
  }

  return (
    <div className={CARD}>
      <div className="space-y-6">
        <div
          className="min-h-[6rem] flex items-center justify-center"
          aria-live="polite"
        >
          {spinning ? (
            <div className="text-6xl animate-spin tabular-nums select-none">
              🪙
            </div>
          ) : result ? (
            <div className="text-6xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {result}
            </div>
          ) : (
            <div className="text-base text-gray-400 dark:text-gray-500">
              Tap Flip to start
            </div>
          )}
        </div>
        <button onClick={flip} disabled={spinning} className={PRIMARY_BTN}>
          {spinning ? 'Flipping…' : 'Flip'}
        </button>
        <History items={history} />
      </div>
    </div>
  )
}

/* ── Dice tab ── */

function DiceTab() {
  const [settings, setSettings] = useLocalStorage<DiceSettings>(
    'snappet:random-picker:dice',
    DEFAULT_DICE,
  )
  const [result, setResult] = useState<DiceResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  function setCount(value: number) {
    const clamped = Math.max(1, Math.min(10, Math.round(value)))
    setSettings({ ...settings, count: clamped })
  }

  function setSides(value: DieSides) {
    setSettings({ ...settings, sides: value })
  }

  function roll() {
    haptic()
    const rolls: number[] = []
    for (let i = 0; i < settings.count; i++) {
      rolls.push(secureRandomInt(1, settings.sides))
    }
    const total = rolls.reduce((a, b) => a + b, 0)
    const next: DiceResult = { rolls, total, sides: settings.sides }
    setResult(next)
    const summary = `${rolls.join(' + ')} = ${total} (d${settings.sides})`
    setHistory((prev) => [summary, ...prev].slice(0, MAX_HISTORY))
  }

  return (
    <div className={CARD}>
      <div className="space-y-6">
        <div
          className="min-h-[6rem] flex flex-col items-center justify-center gap-2"
          aria-live="polite"
        >
          {result ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {result.rolls.map((r, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center justify-center min-w-[3rem] h-12 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100"
                  >
                    {r}
                  </span>
                ))}
              </div>
              <div className="text-4xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                = {result.total}
              </div>
            </>
          ) : (
            <div className="text-base text-gray-400 dark:text-gray-500">
              Tap Roll to start
            </div>
          )}
        </div>

        <button onClick={roll} className={PRIMARY_BTN}>
          Roll
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dice-count" className={LABEL}>
              Dice (1–10)
            </label>
            <input
              id="dice-count"
              type="number"
              min={1}
              max={10}
              inputMode="numeric"
              value={settings.count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="dice-sides" className={LABEL}>
              Sides
            </label>
            <select
              id="dice-sides"
              value={settings.sides}
              onChange={(e) => setSides(Number(e.target.value) as DieSides)}
              className={SELECT}
            >
              {DICE_SIDES.map((s) => (
                <option key={s} value={s}>
                  d{s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <History items={history} />
      </div>
    </div>
  )
}

/* ── Number tab ── */

function NumberTab() {
  const [settings, setSettings] = useLocalStorage<NumberSettings>(
    'snappet:random-picker:number',
    DEFAULT_NUMBER,
  )
  const [result, setResult] = useState<NumberResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  function setMin(value: number) {
    if (Number.isNaN(value)) return
    setSettings({ ...settings, min: Math.round(value) })
  }

  function setMax(value: number) {
    if (Number.isNaN(value)) return
    setSettings({ ...settings, max: Math.round(value) })
  }

  // min === max is allowed (always returns that value); secureRandomInt swaps if reversed.

  function generate() {
    haptic()
    const value = secureRandomInt(settings.min, settings.max)
    const next: NumberResult = { value, min: settings.min, max: settings.max }
    setResult(next)
    const summary = `${value} (from ${Math.min(settings.min, settings.max)}–${Math.max(
      settings.min,
      settings.max,
    )})`
    setHistory((prev) => [summary, ...prev].slice(0, MAX_HISTORY))
  }

  return (
    <div className={CARD}>
      <div className="space-y-6">
        <div
          className="min-h-[6rem] flex items-center justify-center"
          aria-live="polite"
        >
          {result ? (
            <div className="text-6xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {result.value.toLocaleString()}
            </div>
          ) : (
            <div className="text-base text-gray-400 dark:text-gray-500">
              Tap Generate to start
            </div>
          )}
        </div>

        <button onClick={generate} className={PRIMARY_BTN}>
          Generate
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="num-min" className={LABEL}>
              Min
            </label>
            <input
              id="num-min"
              type="number"
              inputMode="numeric"
              value={settings.min}
              onChange={(e) => setMin(Number(e.target.value))}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="num-max" className={LABEL}>
              Max
            </label>
            <input
              id="num-max"
              type="number"
              inputMode="numeric"
              value={settings.max}
              onChange={(e) => setMax(Number(e.target.value))}
              className={INPUT}
            />
          </div>
        </div>

        <History items={history} />
      </div>
    </div>
  )
}

/* ── Pick tab ── */

function PickTab() {
  const [raw, setRaw] = useLocalStorage<string>(
    'snappet:random-picker:pickItems',
    DEFAULT_PICK_ITEMS,
  )
  const [result, setResult] = useState<PickResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const items = splitItems(raw)
  const canPick = items.length > 0

  function pick() {
    if (!canPick) return
    haptic()
    const idx = secureRandomInt(0, items.length - 1)
    const value = items[idx]
    setResult({ value })
    setHistory((prev) => [value, ...prev].slice(0, MAX_HISTORY))
  }

  return (
    <div className={CARD}>
      <div className="space-y-6">
        <div
          className="min-h-[6rem] flex items-center justify-center px-2 text-center"
          aria-live="polite"
        >
          {result ? (
            <div className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 break-words">
              {result.value}
            </div>
          ) : (
            <div className="text-base text-gray-400 dark:text-gray-500">
              {canPick
                ? 'Tap Pick one to start'
                : 'Add items below to pick from'}
            </div>
          )}
        </div>

        <button onClick={pick} disabled={!canPick} className={PRIMARY_BTN}>
          Pick one
        </button>

        <div>
          <label htmlFor="pick-items" className={LABEL}>
            Items (one per line) · {items.length}
          </label>
          <textarea
            id="pick-items"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={DEFAULT_PICK_ITEMS}
            className={`${INPUT} font-mono resize-y`}
            spellCheck={false}
          />
        </div>

        <History items={history} />
      </div>
    </div>
  )
}

/* ── Shuffle tab ── */

function ShuffleTab() {
  const [raw, setRaw] = useLocalStorage<string>(
    'snappet:random-picker:shuffleItems',
    DEFAULT_SHUFFLE_ITEMS,
  )
  const [result, setResult] = useState<ShuffleResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const items = splitItems(raw)
  const canShuffle = items.length > 1

  function doShuffle() {
    if (!canShuffle) return
    haptic()
    const next = shuffle(items)
    setResult({ items: next })
    setHistory((prev) => [next.join(', '), ...prev].slice(0, MAX_HISTORY))
  }

  return (
    <div className={CARD}>
      <div className="space-y-6">
        <div
          className="min-h-[6rem] flex items-center justify-center px-2"
          aria-live="polite"
        >
          {result ? (
            <ol className="w-full space-y-1.5 list-decimal list-inside font-mono tabular-nums text-sm text-gray-900 dark:text-gray-100">
              {result.items.map((item, idx) => (
                <li key={idx} className="break-words">
                  {item}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-base text-gray-400 dark:text-gray-500">
              {canShuffle
                ? 'Tap Shuffle to start'
                : 'Add at least 2 items to shuffle'}
            </div>
          )}
        </div>

        <button onClick={doShuffle} disabled={!canShuffle} className={PRIMARY_BTN}>
          Shuffle
        </button>

        <div>
          <label htmlFor="shuffle-items" className={LABEL}>
            Items (one per line) · {items.length}
          </label>
          <textarea
            id="shuffle-items"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={DEFAULT_SHUFFLE_ITEMS}
            className={`${INPUT} font-mono resize-y`}
            spellCheck={false}
          />
        </div>

        <History items={history} />
      </div>
    </div>
  )
}

/* ── Main component ── */

export default function RandomPicker() {
  const [tab, setTab] = useLocalStorage<TabKey>(
    'snappet:random-picker:tab',
    'coin',
  )

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Random Picker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Flip a coin, roll dice, pick from a list, or generate a random number.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <Tabs active={tab} onChange={setTab} />

      {/* Active tab — mount fresh per tab so history + ephemeral state reset on switch */}
      {tab === 'coin' && <CoinTab />}
      {tab === 'dice' && <DiceTab />}
      {tab === 'number' && <NumberTab />}
      {tab === 'pick' && <PickTab />}
      {tab === 'shuffle' && <ShuffleTab />}
    </div>
  )
}
