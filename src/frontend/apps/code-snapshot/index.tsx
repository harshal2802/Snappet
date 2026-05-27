import { useRef, useCallback, useState } from 'react'
import { Highlight } from 'prism-react-renderer'
import { toPng, toBlob } from 'html-to-image'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import {
  THEMES,
  BACKGROUNDS,
  LANGUAGES,
  getTheme,
  getBackground,
  getLanguageLabel,
} from './themes'
import type {
  SupportedLanguage,
  ThemeId,
  BackgroundId,
  PaddingValue,
  BorderRadiusValue,
  FontSizeValue,
} from './types'

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const PADDING_OPTIONS: PaddingValue[] = [16, 32, 48, 64]
const BORDER_RADIUS_OPTIONS: BorderRadiusValue[] = [0, 8, 16, 24]
const FONT_SIZE_OPTIONS: FontSizeValue[] = [14, 16, 18, 20]

const DEFAULT_CODE = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Generate the first 10 Fibonacci numbers
const result = Array.from({ length: 10 }, (_, i) =>
  fibonacci(i)
);

console.log(result);
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`

const DEFAULTS = {
  code: DEFAULT_CODE,
  language: 'javascript' as SupportedLanguage,
  themeId: 'dracula' as ThemeId,
  backgroundId: 'ocean' as BackgroundId,
  padding: 48 as PaddingValue,
  borderRadius: 16 as BorderRadiusValue,
  showWindowControls: true,
  fontSize: 16 as FontSizeValue,
  showLineNumbers: true,
}

const KEY_PREFIX = 'snappet:code-snapshot'

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function WindowControls() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="block w-3 h-3 rounded-full bg-[#ff5f57]" />
      <span className="block w-3 h-3 rounded-full bg-[#febc2e]" />
      <span className="block w-3 h-3 rounded-full bg-[#28c840]" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export default function CodeSnapshot() {
  const previewRef = useRef<HTMLDivElement>(null)

  // Persisted settings
  const [code, setCode] = useLocalStorage(`${KEY_PREFIX}:code`, DEFAULTS.code)
  const [language, setLanguage] = useLocalStorage<SupportedLanguage>(
    `${KEY_PREFIX}:language`,
    DEFAULTS.language,
  )
  const [themeId, setThemeId] = useLocalStorage<ThemeId>(
    `${KEY_PREFIX}:themeId`,
    DEFAULTS.themeId,
  )
  const [backgroundId, setBackgroundId] = useLocalStorage<BackgroundId>(
    `${KEY_PREFIX}:backgroundId`,
    DEFAULTS.backgroundId,
  )
  const [padding, setPadding] = useLocalStorage<PaddingValue>(
    `${KEY_PREFIX}:padding`,
    DEFAULTS.padding,
  )
  const [borderRadius, setBorderRadius] = useLocalStorage<BorderRadiusValue>(
    `${KEY_PREFIX}:borderRadius`,
    DEFAULTS.borderRadius,
  )
  const [showWindowControls, setShowWindowControls] = useLocalStorage(
    `${KEY_PREFIX}:showWindowControls`,
    DEFAULTS.showWindowControls,
  )
  const [fontSize, setFontSize] = useLocalStorage<FontSizeValue>(
    `${KEY_PREFIX}:fontSize`,
    DEFAULTS.fontSize,
  )
  const [showLineNumbers, setShowLineNumbers] = useLocalStorage(
    `${KEY_PREFIX}:showLineNumbers`,
    DEFAULTS.showLineNumbers,
  )

  // Transient UI state
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const theme = getTheme(themeId)
  const background = getBackground(backgroundId)

  // Reset all persisted state
  function handleReset() {
    setCode(DEFAULTS.code)
    setLanguage(DEFAULTS.language)
    setThemeId(DEFAULTS.themeId)
    setBackgroundId(DEFAULTS.backgroundId)
    setPadding(DEFAULTS.padding)
    setBorderRadius(DEFAULTS.borderRadius)
    setShowWindowControls(DEFAULTS.showWindowControls)
    setFontSize(DEFAULTS.fontSize)
    setShowLineNumbers(DEFAULTS.showLineNumbers)
  }

  // Export helpers
  const handleDownload = useCallback(async () => {
    if (!previewRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = 'code-snapshot.png'
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to export image:', err)
    } finally {
      setExporting(false)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (!previewRef.current) return
    setExporting(true)
    try {
      const blob = await toBlob(previewRef.current, { pixelRatio: 2 })
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy image:', err)
    } finally {
      setExporting(false)
    }
  }, [])

  // Line count for the code textarea
  const lineCount = code.split('\n').length

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Code Snapshot
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate beautiful code screenshots with customizable themes.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ↺ Reset
        </button>
      </div>

      {/* Main layout: preview + controls */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Code input + Live preview ── */}
        <div className="flex-1 lg:w-[65%] space-y-4">
          {/* Code input */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Code Input
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {lineCount} {lineCount === 1 ? 'line' : 'lines'}
              </span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              spellCheck={false}
              className="w-full h-48 p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500 resize-y focus:outline-none"
            />
          </div>

          {/* Live preview */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Preview
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  disabled={exporting || !code.trim()}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {copied ? 'Copied!' : 'Copy Image'}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={exporting || !code.trim()}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {exporting ? 'Exporting...' : 'Download PNG'}
                </button>
              </div>
            </div>

            {/* Preview canvas — this is what gets exported */}
            <div className="overflow-auto p-4 bg-gray-100 dark:bg-gray-900/50">
              <div
                ref={previewRef}
                style={{
                  padding: `${padding}px`,
                  backgroundImage: background.gradient !== 'transparent' ? background.gradient : undefined,
                  backgroundColor: background.gradient === 'transparent' ? 'transparent' : undefined,
                }}
              >
                {/* Code window */}
                <div
                  style={{
                    backgroundColor: theme.bgColor,
                    borderRadius: `${borderRadius}px`,
                  }}
                  className="overflow-hidden shadow-2xl"
                >
                  {/* Window chrome */}
                  {showWindowControls && <WindowControls />}

                  {/* Syntax-highlighted code */}
                  <Highlight
                    theme={theme.prismTheme}
                    code={code.trimEnd()}
                    language={language}
                  >
                    {({ tokens, getLineProps, getTokenProps }) => (
                      <pre
                        className="overflow-x-auto m-0"
                        style={{
                          padding: showWindowControls
                            ? '0 16px 16px 16px'
                            : '16px',
                          fontSize: `${fontSize}px`,
                          lineHeight: 1.6,
                          fontFamily:
                            "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Consolas', monospace",
                          margin: 0,
                          background: 'transparent',
                        }}
                      >
                        {tokens.map((line, i) => {
                          const lineProps = getLineProps({ line })
                          return (
                            <div
                              key={i}
                              {...lineProps}
                              style={{
                                ...lineProps.style,
                                display: 'flex',
                              }}
                            >
                              {showLineNumbers && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: `${String(tokens.length).length * 0.75 + 0.5}em`,
                                    textAlign: 'right',
                                    paddingRight: '1em',
                                    userSelect: 'none',
                                    opacity: 0.35,
                                    flexShrink: 0,
                                  }}
                                >
                                  {i + 1}
                                </span>
                              )}
                              <span className="flex-1">
                                {line.map((token, j) => {
                                  const tokenProps = getTokenProps({ token })
                                  return (
                                    <span key={j} {...tokenProps} />
                                  )
                                })}
                              </span>
                            </div>
                          )
                        })}
                      </pre>
                    )}
                  </Highlight>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Controls sidebar ── */}
        <div className="lg:w-[35%] space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-5">
            {/* Language */}
            <ControlSection label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Current: {getLanguageLabel(language)}
              </p>
            </ControlSection>

            {/* Theme */}
            <ControlSection label="Theme">
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    title={t.label}
                    className={`group relative h-8 rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      themeId === t.id
                        ? 'border-blue-500 ring-1 ring-blue-500/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: t.bgColor }}
                  >
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: t.isLight ? '#24292f' : '#e0e0e0' }}
                    >
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Active: {theme.label}
              </p>
            </ControlSection>

            {/* Background */}
            <ControlSection label="Background">
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setBackgroundId(bg.id)}
                    title={bg.label}
                    className={`h-8 rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      backgroundId === bg.id
                        ? 'border-blue-500 ring-1 ring-blue-500/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
                    } ${bg.id === 'none' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                    style={
                      bg.gradient !== 'transparent'
                        ? { backgroundImage: bg.gradient }
                        : undefined
                    }
                  >
                    {bg.id === 'none' && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        None
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Active: {background.label}
              </p>
            </ControlSection>

            {/* Padding */}
            <ControlSection label="Padding">
              <div className="flex gap-2">
                {PADDING_OPTIONS.map((p) => (
                  <PresetButton
                    key={p}
                    active={padding === p}
                    onClick={() => setPadding(p)}
                    label={`${p}px`}
                  />
                ))}
              </div>
            </ControlSection>

            {/* Border Radius */}
            <ControlSection label="Border Radius">
              <div className="flex gap-2">
                {BORDER_RADIUS_OPTIONS.map((r) => (
                  <PresetButton
                    key={r}
                    active={borderRadius === r}
                    onClick={() => setBorderRadius(r)}
                    label={`${r}px`}
                  />
                ))}
              </div>
            </ControlSection>

            {/* Font Size */}
            <ControlSection label="Font Size">
              <div className="flex gap-2">
                {FONT_SIZE_OPTIONS.map((s) => (
                  <PresetButton
                    key={s}
                    active={fontSize === s}
                    onClick={() => setFontSize(s)}
                    label={`${s}px`}
                  />
                ))}
              </div>
            </ControlSection>

            {/* Toggles */}
            <ControlSection label="Options">
              <div className="space-y-3">
                <ToggleSwitch
                  label="Window controls"
                  checked={showWindowControls}
                  onChange={setShowWindowControls}
                />
                <ToggleSwitch
                  label="Line numbers"
                  checked={showLineNumbers}
                  onChange={setShowLineNumbers}
                />
              </div>
            </ControlSection>
          </div>

          {/* Export buttons (duplicate for mobile convenience) */}
          <div className="flex gap-2 lg:hidden">
            <button
              onClick={handleCopy}
              disabled={exporting || !code.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {copied ? 'Copied!' : 'Copy Image'}
            </button>
            <button
              onClick={handleDownload}
              disabled={exporting || !code.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {exporting ? 'Exporting...' : 'Download PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Reusable small components                                           */
/* ------------------------------------------------------------------ */

function ControlSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}

function PresetButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active
          ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
    >
      {label}
    </button>
  )
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          checked
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
