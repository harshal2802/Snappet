import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'

interface Settings {
  length: number
  upper: boolean
  lower: boolean
  numbers: boolean
  symbols: boolean
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/'

const DEFAULT_SETTINGS: Settings = {
  length: 16,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
}

type Tier = 'Weak' | 'Fair' | 'Strong' | 'Very Strong'

function buildPool(s: Settings): string {
  return (
    (s.upper ? UPPER : '') +
    (s.lower ? LOWER : '') +
    (s.numbers ? NUMBERS : '') +
    (s.symbols ? SYMBOLS : '')
  )
}

// Modulo bias is negligible at our pool sizes (<= 78 chars) given a 32-bit
// source — the worst-case bias is < 1 part in 50 million. Acceptable.
function generate(settings: Settings): string {
  const pool = buildPool(settings)
  if (pool.length === 0 || settings.length === 0) return ''
  const buf = new Uint32Array(settings.length)
  window.crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < settings.length; i++) {
    out += pool[buf[i] % pool.length]
  }
  return out
}

function entropyBits(length: number, poolSize: number): number {
  if (poolSize <= 1 || length <= 0) return 0
  return length * Math.log2(poolSize)
}

function strengthLabel(bits: number): Tier {
  if (bits < 40) return 'Weak'
  if (bits < 60) return 'Fair'
  if (bits < 80) return 'Strong'
  return 'Very Strong'
}

const TIER_BAR: Record<Tier, string> = {
  Weak: 'bg-red-500 dark:bg-red-400',
  Fair: 'bg-amber-500 dark:bg-amber-400',
  Strong: 'bg-blue-500 dark:bg-blue-400',
  'Very Strong': 'bg-green-500 dark:bg-green-400',
}

const TIER_TEXT: Record<Tier, string> = {
  Weak: 'text-red-600 dark:text-red-400',
  Fair: 'text-amber-600 dark:text-amber-400',
  Strong: 'text-blue-600 dark:text-blue-400',
  'Very Strong': 'text-green-600 dark:text-green-400',
}

const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  hint?: string
}

function Toggle({ label, checked, onChange, hint }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={`relative inline-block w-9 h-5 rounded-full transition-colors ${
          checked
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      {hint && (
        <span className="text-xs text-amber-600 dark:text-amber-400">{hint}</span>
      )}
    </label>
  )
}

export default function PasswordGenerator() {
  const [settings, setSettings] = useLocalStorage<Settings>(
    'snappet:password-generator:settings',
    DEFAULT_SETTINGS,
  )
  const [bump, setBump] = useState(0)
  const [copied, setCopied] = useState(false)
  const [fallbackEnabled, setFallbackEnabled] = useState(false)

  // Defensive: if persisted settings have all toggles off, force Lowercase on.
  useEffect(() => {
    if (!settings.upper && !settings.lower && !settings.numbers && !settings.symbols) {
      setSettings({ ...settings, lower: true })
      setFallbackEnabled(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pool = useMemo(() => buildPool(settings), [settings])
  const bits = useMemo(
    () => entropyBits(settings.length, pool.length),
    [settings.length, pool],
  )
  const tier = strengthLabel(bits)
  const fillPct = Math.min(100, (bits / 128) * 100)

  const password = useMemo(
    () => generate(settings),
    // bump bumps the memo when the user clicks Regenerate
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, bump],
  )

  function setToggle(key: 'upper' | 'lower' | 'numbers' | 'symbols', value: boolean) {
    const next = { ...settings, [key]: value }
    if (!next.upper && !next.lower && !next.numbers && !next.symbols) {
      // Re-enable Lowercase as fallback rather than allowing an empty pool.
      next.lower = true
      setFallbackEnabled(true)
      window.setTimeout(() => setFallbackEnabled(false), 2000)
    }
    setSettings(next)
  }

  function setLength(value: number) {
    const clamped = Math.max(8, Math.min(64, Math.round(value)))
    setSettings({ ...settings, length: clamped })
  }

  function handleCopy() {
    navigator.clipboard.writeText(password).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        // ignore
      },
    )
  }

  function handleReset() {
    setSettings(DEFAULT_SETTINGS)
    setBump((b) => b + 1)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Password Generator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate strong passwords with cryptographically secure randomness.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="password-generator" steps={tourSteps} />
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Password display */}
      <div className={CARD}>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-4 mb-3" data-tour="password">
          <p
            className="font-mono text-lg sm:text-xl text-gray-900 dark:text-gray-100 break-all select-all"
            aria-label="Generated password"
          >
            {password || '—'}
          </p>
        </div>
        <div className="flex gap-2" data-tour="actions">
          <button
            onClick={handleCopy}
            disabled={!password}
            className="flex-1 px-3 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setBump((b) => b + 1)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ↻ Regenerate
          </button>
        </div>

        {/* Strength bar */}
        <div className="mt-4 space-y-1" data-tour="strength">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${TIER_TEXT[tier]}`}>{tier}</span>
            <span className="text-gray-400 dark:text-gray-500 font-mono">
              {bits.toFixed(0)} bits
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full ${TIER_BAR[tier]} transition-all duration-300`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className={CARD}>
        <div className="space-y-4">
          <div data-tour="length">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="pwd-length"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Length
              </label>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                {settings.length}
              </span>
            </div>
            <input
              id="pwd-length"
              type="range"
              min={8}
              max={64}
              value={settings.length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full accent-blue-600 dark:accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              <span>8</span>
              <span>64</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3" data-tour="charsets">
            <Toggle
              label="Uppercase (A–Z)"
              checked={settings.upper}
              onChange={(v) => setToggle('upper', v)}
            />
            <Toggle
              label="Lowercase (a–z)"
              checked={settings.lower}
              onChange={(v) => setToggle('lower', v)}
              hint={fallbackEnabled ? 'kept on — one set required' : undefined}
            />
            <Toggle
              label="Numbers (0–9)"
              checked={settings.numbers}
              onChange={(v) => setToggle('numbers', v)}
            />
            <Toggle
              label="Symbols (!@#…)"
              checked={settings.symbols}
              onChange={(v) => setToggle('symbols', v)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
