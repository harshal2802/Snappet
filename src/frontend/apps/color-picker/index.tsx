import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

interface Rgb {
  r: number
  g: number
  b: number
}

interface Hsl {
  h: number
  s: number
  l: number
}

const DEFAULT_HEX = '#3b82f6'

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseHex(input: string): Rgb | null {
  const m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(input.trim())
  if (m3) {
    return {
      r: parseInt(m3[1] + m3[1], 16),
      g: parseInt(m3[2] + m3[2], 16),
      b: parseInt(m3[3] + m3[3], 16),
    }
  }
  const m6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(input.trim())
  if (m6) {
    return {
      r: parseInt(m6[1], 16),
      g: parseInt(m6[2], 16),
      b: parseInt(m6[3], 16),
    }
  }
  return null
}

function parseRgb(input: string): Rgb | null {
  const m = /^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(
    input.trim(),
  )
  if (!m) return null
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  if ([r, g, b].some((v) => v < 0 || v > 255)) return null
  return { r, g, b }
}

function parseHsl(input: string): Hsl | null {
  const m =
    /^hsl\s*\(\s*(\d{1,3}(?:\.\d+)?)\s*,\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*,\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*\)$/i.exec(
      input.trim(),
    )
  if (!m) return null
  const h = Number(m[1])
  const s = Number(m[2])
  const l = Number(m[3])
  if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) return null
  return { h, s, l }
}

// ── Conversion ──────────────────────────────────────────────────────────────

function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rf = r / 255
  const gf = g / 255
  const bf = b / 255
  const max = Math.max(rf, gf, bf)
  const min = Math.min(rf, gf, bf)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rf:
        h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60
        break
      case gf:
        h = ((bf - rf) / d + 2) * 60
        break
      case bf:
        h = ((rf - gf) / d + 4) * 60
        break
    }
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sf = s / 100
  const lf = l / 100
  if (sf === 0) {
    const v = Math.round(lf * 255)
    return { r: v, g: v, b: v }
  }
  const q = lf < 0.5 ? lf * (1 + sf) : lf + sf - lf * sf
  const p = 2 * lf - q
  const hk = (h % 360) / 360
  const tc = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return {
    r: Math.round(tc(hk + 1 / 3) * 255),
    g: Math.round(tc(hk) * 255),
    b: Math.round(tc(hk - 1 / 3) * 255),
  }
}

function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`
}

function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${h}, ${s}%, ${l}%)`
}

// ── Contrast (WCAG relative luminance) ───────────────────────────────────────

function channelLum(c: number): number {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

// ── UI ──────────────────────────────────────────────────────────────────────

const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm'

const INPUT_BASE =
  'flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
const INPUT_OK = 'border-gray-300 dark:border-gray-600'
const INPUT_ERR = 'border-red-400 dark:border-red-500'

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 0, g: 0, b: 0 }

interface FormatRowProps {
  label: string
  draft: string
  isValid: boolean
  onChange: (value: string) => void
  onCommit: () => void
}

function FormatRow({ label, draft, isValid, onChange, onCommit }: FormatRowProps) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(draft).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        // ignore
      },
    )
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <input
        type="text"
        value={draft}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
        }}
        className={`${INPUT_BASE} ${isValid ? INPUT_OK : INPUT_ERR}`}
      />
      <button
        onClick={handleCopy}
        className="px-3 py-2 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function ColorPicker() {
  const [hex, setHex] = useLocalStorage<string>(
    'snappet:color-picker:hex',
    DEFAULT_HEX,
  )

  // The hex stored in localStorage is the source of truth. Derive rgb/hsl.
  const rgb = useMemo<Rgb>(() => parseHex(hex) ?? { r: 59, g: 130, b: 246 }, [hex])
  const hsl = useMemo<Hsl>(() => rgbToHsl(rgb), [rgb])
  const canonicalHex = useMemo(() => rgbToHex(rgb), [rgb])
  const rgbStr = useMemo(() => formatRgb(rgb), [rgb])
  const hslStr = useMemo(() => formatHsl(hsl), [hsl])

  const [hexDraft, setHexDraft] = useState(canonicalHex)
  const [rgbDraft, setRgbDraft] = useState(rgbStr)
  const [hslDraft, setHslDraft] = useState(hslStr)
  const [hexValid, setHexValid] = useState(true)
  const [rgbValid, setRgbValid] = useState(true)
  const [hslValid, setHslValid] = useState(true)

  // When the canonical color changes (e.g. native picker, Reset, parse from
  // another format), sync drafts that aren't currently being edited.
  useEffect(() => {
    setHexDraft(canonicalHex)
    setHexValid(true)
  }, [canonicalHex])
  useEffect(() => {
    setRgbDraft(rgbStr)
    setRgbValid(true)
  }, [rgbStr])
  useEffect(() => {
    setHslDraft(hslStr)
    setHslValid(true)
  }, [hslStr])

  function commitHex() {
    const parsed = parseHex(hexDraft)
    if (parsed) {
      setHex(rgbToHex(parsed))
      setHexValid(true)
    } else {
      setHexValid(false)
    }
  }
  function commitRgb() {
    const parsed = parseRgb(rgbDraft)
    if (parsed) {
      setHex(rgbToHex(parsed))
      setRgbValid(true)
    } else {
      setRgbValid(false)
    }
  }
  function commitHsl() {
    const parsed = parseHsl(hslDraft)
    if (parsed) {
      setHex(rgbToHex(hslToRgb(parsed)))
      setHslValid(true)
    } else {
      setHslValid(false)
    }
  }

  function handlePicker(value: string) {
    setHex(value.toLowerCase())
  }

  function handleReset() {
    setHex(DEFAULT_HEX)
  }

  const contrastWhite = contrastRatio(rgb, WHITE)
  const contrastBlack = contrastRatio(rgb, BLACK)

  function contrastBadge(ratio: number): string {
    const ok = ratio >= 4.5
    return ok
      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Color Picker & Converter
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pick or paste a color in any format — convert between HEX, RGB, and HSL instantly.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ↺ Reset
        </button>
      </div>

      {/* Picker + format rows */}
      <div className={CARD}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Native picker */}
          <div className="flex flex-col items-center gap-2">
            <input
              type="color"
              value={canonicalHex}
              onChange={(e) => handlePicker(e.target.value)}
              aria-label="Pick a color"
              className="w-20 h-20 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer bg-transparent"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">Pick</span>
          </div>

          {/* Format rows */}
          <div className="flex-1 space-y-3 w-full">
            <FormatRow
              label="HEX"
              draft={hexDraft}
              isValid={hexValid}
              onChange={(v) => {
                setHexDraft(v)
                setHexValid(true)
              }}
              onCommit={commitHex}
            />
            <FormatRow
              label="RGB"
              draft={rgbDraft}
              isValid={rgbValid}
              onChange={(v) => {
                setRgbDraft(v)
                setRgbValid(true)
              }}
              onCommit={commitRgb}
            />
            <FormatRow
              label="HSL"
              draft={hslDraft}
              isValid={hslValid}
              onChange={(v) => {
                setHslDraft(v)
                setHslValid(true)
              }}
              onCommit={commitHsl}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
        <div
          className="px-6 py-10 flex flex-wrap items-center justify-around gap-6"
          style={{ backgroundColor: canonicalHex }}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl font-bold text-white drop-shadow-sm">Aa</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${contrastBadge(contrastWhite)}`}>
              {contrastWhite.toFixed(2)}:1 on white
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl font-bold text-black drop-shadow-sm">Aa</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${contrastBadge(contrastBlack)}`}>
              {contrastBlack.toFixed(2)}:1 on black
            </span>
          </div>
        </div>
        <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            WCAG AA body text requires 4.5:1; large text requires 3:1.
          </p>
        </div>
      </div>
    </div>
  )
}
