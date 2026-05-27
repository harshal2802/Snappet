# Prompt: QR Code Generator

**File**: pdd/prompts/features/qr-code/20-qr-code-generator.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: 5-app mobile-friendly brainstorm in pdd/context/research/mobile-friendly-app-ideas.md
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps deployed as a PWA. This is the QR Code Generator at `/qr-code`. It produces scannable QR codes for arbitrary text, URLs, WiFi credentials, and vCards. The mobile angle: generate on a desktop and scan with a phone, or generate on phone A and scan with phone B — handy for sharing a URL, joining WiFi without typing the password, or swapping contact info offline.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. Adds one runtime dependency: `qrcode` (~25 KB gz, renders QR codes via canvas / data URLs) and its `@types/qrcode` dev-dep.

## Task

A single-file mini-app that:

1. **Format tab bar** — Text / URL / WiFi / vCard. The selected tab determines which input fields are shown and how the payload string is encoded for the QR.
2. **Format-specific inputs**
   - Text: single `<textarea>`
   - URL: single `<input type="url" inputmode="url">`
   - WiFi: SSID, password, security (WPA / WPA2 / WEP / None) — encoded as `WIFI:T:<sec>;S:<ssid>;P:<pwd>;;`
   - vCard: name, phone, email, organization — encoded as a `BEGIN:VCARD…END:VCARD` block (vCard 3.0)
3. **Error-correction-level segmented control** — `L` / `M` / `Q` / `H`. Default `M`. Higher levels mean denser QR but more damage tolerance.
4. **Live QR preview** — a big white square (≥ 256×256 px, 320×320 on mobile) centered below the inputs. Stays white-on-black even in dark mode (white background, black modules) so cameras can scan reliably.
5. **Download PNG** — generates a PNG data URL and triggers download as `qr-code.png`.
6. **Native Share** — uses the Web Share API with `files` if available (`navigator.canShare?.({ files: [...] })`). When unsupported the button is hidden.
7. **Inline error** — when the encoded payload is empty / invalid, show a small inline error message instead of rendering a broken QR.
8. **Persistence + Reset** — every input field and the EC level are persisted to localStorage under `snappet:qr-code:*` keys. Reset clears all fields back to defaults.

## Encoding

```ts
type Format = 'text' | 'url' | 'wifi' | 'vcard'
type EcLevel = 'L' | 'M' | 'Q' | 'H'
type WifiSecurity = 'WPA' | 'WPA2' | 'WEP' | 'nopass'

interface WifiInputs { ssid: string; password: string; security: WifiSecurity }
interface VCardInputs { name: string; phone: string; email: string; org: string }

// Returns the payload string to encode in the QR — or '' when invalid / empty.
function encodePayload(format: Format, inputs: ...): string

// WiFi: escape `\`, `;`, `,`, `:`, `"` per the WIFI: URI spec.
// vCard: emit vCard 3.0 with VERSION line, ORG/FN/TEL/EMAIL.
```

Library use:

```ts
import QRCode from 'qrcode'
const dataUrl = await QRCode.toDataURL(payload, {
  errorCorrectionLevel: 'M',
  width: 512,
  margin: 2,
})
```

The same data URL backs both the on-screen `<img>` and the download. For Web Share, convert the data URL to a `Blob`, wrap in a `File`, and call `navigator.share({ files: [file] })`.

## Output format

### 1. `src/frontend/apps/qr-code/index.tsx`

Default-exported `QrCodeGenerator` component. Layout (`max-w-xl mx-auto space-y-6`):
- Header row with title + Reset
- Format tab bar (Text / URL / WiFi / vCard) — segmented buttons styled like the markdown-editor mobile toggle
- Format-specific input card
- EC-level segmented control (`L` / `M` / `Q` / `H`)
- Big centered white QR card (≥ 256 px, 320 px on mobile)
- Download PNG + Share buttons (Share hidden when not supported)
- Small "Scan with another phone or camera app" hint

State keys persisted to localStorage:

- `snappet:qr-code:format` — current tab
- `snappet:qr-code:ec` — error correction level
- `snappet:qr-code:text`, `snappet:qr-code:url`
- `snappet:qr-code:wifi` — `{ ssid, password, security }`
- `snappet:qr-code:vcard` — `{ name, phone, email, org }`

The data URL is produced inside an effect (since `QRCode.toDataURL` is async) and stored in `useState<string | null>`. On generation error or empty payload, set it to `null` and show the inline error.

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/qr-code',
  label: 'QR Code Generator',
  description: 'Generate scannable QR codes for text, URLs, WiFi, and contacts.',
  category: 'Utilities',
  icon: '📲',
  component: lazy(() => import('../apps/qr-code')),
}
```

### 3. Dependency

Add `qrcode` to `dependencies` and `@types/qrcode` to `devDependencies` in `src/frontend/package.json` (via `npm install`).

## Acceptance criteria

- [ ] Text / URL / WiFi / vCard tabs each produce a scannable QR
- [ ] EC level toggle visibly changes QR density
- [ ] Download PNG saves a `qr-code.png` to disk
- [ ] Share button appears on iOS Safari (Web Share API) and hides on desktop Chrome / Firefox where `canShare({files})` is false
- [ ] Empty / invalid input shows an inline error instead of a broken QR
- [ ] All inputs persist across reload
- [ ] Reset returns everything to defaults
- [ ] Mobile layout (375 px) — QR is 320 px wide and centered, buttons are thumb-sized
- [ ] Dark mode — QR card stays white-on-white for camera reliability
- [ ] `npx tsc --noEmit` and `npm run build` are clean

## Constraints

- TypeScript strict; no `any`. Functional component only.
- Tailwind classes only — no inline styles. Use `inputmode` hints for URL and tel inputs.
- Dark mode + focus-visible rings on every interactive element.
- Mobile-first layout, controls thumb-sized.
- QR canvas / card background must be white in both light and dark themes — cameras need the contrast.
- Do not persist the generated data URL — regenerate on every input change.
- Use the npm `qrcode` package (~25 KB gz), not a server round-trip.
