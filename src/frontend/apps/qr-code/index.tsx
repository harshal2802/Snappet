import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'

// ── Types ───────────────────────────────────────────────────────────────────

type Format = 'text' | 'url' | 'wifi' | 'vcard'
type EcLevel = 'L' | 'M' | 'Q' | 'H'
type WifiSecurity = 'WPA' | 'WPA2' | 'WEP' | 'nopass'

interface WifiInputs {
  ssid: string
  password: string
  security: WifiSecurity
}

interface VCardInputs {
  name: string
  phone: string
  email: string
  org: string
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_TEXT = ''
const DEFAULT_URL = ''
const DEFAULT_WIFI: WifiInputs = { ssid: '', password: '', security: 'WPA2' }
const DEFAULT_VCARD: VCardInputs = { name: '', phone: '', email: '', org: '' }
const DEFAULT_FORMAT: Format = 'text'
const DEFAULT_EC: EcLevel = 'M'

const FORMATS: { id: Format; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'url', label: 'URL' },
  { id: 'wifi', label: 'WiFi' },
  { id: 'vcard', label: 'vCard' },
]

const EC_LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H']
const WIFI_SECURITIES: WifiSecurity[] = ['WPA', 'WPA2', 'WEP', 'nopass']

// ── Encoding helpers ────────────────────────────────────────────────────────

// WIFI: URI spec — escape backslash, semicolon, comma, colon, quote.
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

function encodeWifi(w: WifiInputs): string {
  if (!w.ssid.trim()) return ''
  const sec = w.security === 'nopass' ? 'nopass' : w.security
  const ssid = escapeWifi(w.ssid)
  const password = w.security === 'nopass' ? '' : escapeWifi(w.password)
  return `WIFI:T:${sec};S:${ssid};P:${password};;`
}

// vCard 3.0 — escape commas and semicolons in field values.
function escapeVCard(value: string): string {
  return value.replace(/([\\,;])/g, '\\$1')
}

function encodeVCard(v: VCardInputs): string {
  if (
    !v.name.trim() &&
    !v.phone.trim() &&
    !v.email.trim() &&
    !v.org.trim()
  ) {
    return ''
  }
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  if (v.name.trim()) {
    lines.push(`FN:${escapeVCard(v.name.trim())}`)
    lines.push(`N:${escapeVCard(v.name.trim())};;;;`)
  }
  if (v.org.trim()) lines.push(`ORG:${escapeVCard(v.org.trim())}`)
  if (v.phone.trim()) lines.push(`TEL:${escapeVCard(v.phone.trim())}`)
  if (v.email.trim()) lines.push(`EMAIL:${escapeVCard(v.email.trim())}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}

function encodePayload(
  format: Format,
  text: string,
  url: string,
  wifi: WifiInputs,
  vcard: VCardInputs,
): string {
  switch (format) {
    case 'text':
      return text.trim()
    case 'url':
      return url.trim()
    case 'wifi':
      return encodeWifi(wifi)
    case 'vcard':
      return encodeVCard(vcard)
  }
}

// ── Share helpers ───────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = /data:([^;]+)/.exec(header)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ── UI tokens ───────────────────────────────────────────────────────────────

const CARD =
  'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6 shadow-sm'

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

const LABEL =
  'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1'

const PRIMARY_BTN =
  'flex-1 min-h-[44px] px-4 py-2.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

const SECONDARY_BTN =
  'flex-1 min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

// ── Component ───────────────────────────────────────────────────────────────

export default function QrCodeGenerator() {
  const [format, setFormat] = useLocalStorage<Format>(
    'snappet:qr-code:format',
    DEFAULT_FORMAT,
  )
  const [ec, setEc] = useLocalStorage<EcLevel>('snappet:qr-code:ec', DEFAULT_EC)
  const [text, setText] = useLocalStorage<string>(
    'snappet:qr-code:text',
    DEFAULT_TEXT,
  )
  const [url, setUrl] = useLocalStorage<string>(
    'snappet:qr-code:url',
    DEFAULT_URL,
  )
  const [wifi, setWifi] = useLocalStorage<WifiInputs>(
    'snappet:qr-code:wifi',
    DEFAULT_WIFI,
  )
  const [vcard, setVcard] = useLocalStorage<VCardInputs>(
    'snappet:qr-code:vcard',
    DEFAULT_VCARD,
  )

  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canNativeShare, setCanNativeShare] = useState(false)

  const payload = useMemo(
    () => encodePayload(format, text, url, wifi, vcard),
    [format, text, url, wifi, vcard],
  )

  // Generate the QR data URL on every payload / EC change. Async, so guarded
  // with a cancellation flag to avoid race conditions on rapid input.
  useEffect(() => {
    let cancelled = false
    if (!payload) {
      setDataUrl(null)
      setError('Enter content above to generate a QR code.')
      return () => {
        cancelled = true
      }
    }
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: ec,
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(
      (url) => {
        if (cancelled) return
        setDataUrl(url)
        setError(null)
      },
      (err: unknown) => {
        if (cancelled) return
        setDataUrl(null)
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to generate QR code.',
        )
      },
    )
    return () => {
      cancelled = true
    }
  }, [payload, ec])

  // Probe Web Share API once on mount — needs a sample file to feature-detect
  // `canShare({ files })` correctly.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.canShare) {
      setCanNativeShare(false)
      return
    }
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], 'p.png', {
        type: 'image/png',
      })
      setCanNativeShare(navigator.canShare({ files: [probe] }))
    } catch {
      setCanNativeShare(false)
    }
  }, [])

  function handleDownload() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'qr-code.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleShare() {
    if (!dataUrl) return
    try {
      const blob = dataUrlToBlob(dataUrl)
      const file = new File([blob], 'qr-code.png', { type: 'image/png' })
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        return
      }
      await navigator.share({
        files: [file],
        title: 'QR Code',
        text: 'Scan this QR code',
      })
    } catch {
      // User cancelled or share failed — silently ignore.
    }
  }

  function handleReset() {
    setFormat(DEFAULT_FORMAT)
    setEc(DEFAULT_EC)
    setText(DEFAULT_TEXT)
    setUrl(DEFAULT_URL)
    setWifi(DEFAULT_WIFI)
    setVcard(DEFAULT_VCARD)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            QR Code Generator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate scannable QR codes for text, URLs, WiFi, and contacts.
          </p>
        </div>
        <div className="shrink-0 mt-1 flex items-center gap-2">
          <GuidedTour appId="qr-code" steps={tourSteps} />
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Format tab bar */}
      <div
        role="tablist"
        aria-label="QR code content format"
        className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl"
        data-tour="format"
      >
        {FORMATS.map((f) => {
          const active = format === f.id
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFormat(f.id)}
              className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Format-specific inputs */}
      <div className={CARD} data-tour="content">
        {format === 'text' && (
          <div>
            <label htmlFor="qr-text" className={LABEL}>
              Text
            </label>
            <textarea
              id="qr-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Anything — a note, a poem, a secret…"
              className={`${INPUT} resize-y min-h-[96px]`}
            />
          </div>
        )}

        {format === 'url' && (
          <div>
            <label htmlFor="qr-url" className={LABEL}>
              URL
            </label>
            <input
              id="qr-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className={INPUT}
            />
          </div>
        )}

        {format === 'wifi' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="qr-wifi-ssid" className={LABEL}>
                Network name (SSID)
              </label>
              <input
                id="qr-wifi-ssid"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={wifi.ssid}
                onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                placeholder="MyNetwork"
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="qr-wifi-pass" className={LABEL}>
                Password
              </label>
              <input
                id="qr-wifi-pass"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={wifi.password}
                onChange={(e) =>
                  setWifi({ ...wifi, password: e.target.value })
                }
                placeholder={wifi.security === 'nopass' ? '— not required —' : '••••••••'}
                disabled={wifi.security === 'nopass'}
                className={`${INPUT} disabled:opacity-50`}
              />
            </div>
            <div>
              <span className={LABEL}>Security</span>
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
                {WIFI_SECURITIES.map((s) => {
                  const active = wifi.security === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWifi({ ...wifi, security: s })}
                      aria-pressed={active}
                      className={`flex-1 min-h-[36px] px-2 py-1 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        active
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {s === 'nopass' ? 'None' : s}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {format === 'vcard' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="qr-vc-name" className={LABEL}>
                Full name
              </label>
              <input
                id="qr-vc-name"
                type="text"
                autoCapitalize="words"
                value={vcard.name}
                onChange={(e) => setVcard({ ...vcard, name: e.target.value })}
                placeholder="Ada Lovelace"
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="qr-vc-phone" className={LABEL}>
                Phone
              </label>
              <input
                id="qr-vc-phone"
                type="tel"
                inputMode="tel"
                value={vcard.phone}
                onChange={(e) => setVcard({ ...vcard, phone: e.target.value })}
                placeholder="+1 555 0100"
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="qr-vc-email" className={LABEL}>
                Email
              </label>
              <input
                id="qr-vc-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={vcard.email}
                onChange={(e) => setVcard({ ...vcard, email: e.target.value })}
                placeholder="ada@example.com"
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="qr-vc-org" className={LABEL}>
                Organization
              </label>
              <input
                id="qr-vc-org"
                type="text"
                value={vcard.org}
                onChange={(e) => setVcard({ ...vcard, org: e.target.value })}
                placeholder="Analytical Engines Ltd."
                className={INPUT}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error correction level */}
      <div className={CARD} data-tour="level">
        <div className="flex items-center justify-between mb-2">
          <span className={LABEL}>Error correction</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Higher = denser, more damage tolerant
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Error correction level"
          className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl"
        >
          {EC_LEVELS.map((level) => {
            const active = ec === level
            return (
              <button
                key={level}
                role="radio"
                aria-checked={active}
                onClick={() => setEc(level)}
                className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-mono font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {level}
              </button>
            )
          })}
        </div>
      </div>

      {/* QR preview — white-on-white in both themes so cameras can read it. */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white p-5 sm:p-6 shadow-sm flex flex-col items-center gap-4" data-tour="preview">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Generated QR code"
            width={320}
            height={320}
            className="w-64 h-64 sm:w-80 sm:h-80 rounded-lg"
          />
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-gray-500">
              {error ?? 'Enter content above to generate a QR code.'}
            </p>
          </div>
        )}
        <p className="text-xs text-gray-500 text-center">
          Scan with another phone or camera app.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2" data-tour="actions">
        <button
          onClick={handleDownload}
          disabled={!dataUrl}
          className={PRIMARY_BTN}
        >
          ⬇ Download PNG
        </button>
        {canNativeShare && (
          <button
            onClick={handleShare}
            disabled={!dataUrl}
            className={SECONDARY_BTN}
          >
            ⇪ Share
          </button>
        )}
      </div>
    </div>
  )
}
