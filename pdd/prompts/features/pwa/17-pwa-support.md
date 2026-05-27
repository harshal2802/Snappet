# Prompt: PWA Support

**File**: pdd/prompts/features/pwa/17-pwa-support.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: User request — make Snappet installable + offline-capable
**Plan**: pdd/prompts/features/pwa/PLAN-pwa-support.md
**Research**: pdd/context/research/pwa-support.md
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This prompt makes the entire site installable as a Progressive Web App: an installable icon, an app-shell precache so visited apps continue to work offline, a custom "Update available" banner when a new build ships.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. Deployed to GitHub Pages at base path `/Snappet/`.

**Existing infra**:
- `vite.config.ts` defines `base = process.env.VITE_BASE_PATH ?? '/Snappet/'`
- `index.html` already has a GH Pages 404→SPA redirect script (must not be broken)
- `main.tsx` uses `import.meta.env.BASE_URL` for the router basename
- All app state is in `localStorage` via the shared `useLocalStorage` hook — no backend, nothing to sync online

**Out of scope** (per research):
- Precaching the Document Viewer's CDN-loaded tesseract.js WASM core (~3 MB) and English language model (~10 MB). They're too large to bake into a PWA install. Falls back to the browser HTTP cache — Document Viewer OCR needs online for the first use per machine.

## Architecture

Pure build infrastructure addition. No application logic changes.

```
vite.config.ts ── VitePWA({ ..., pwaAssets, manifest, workbox }) ─── adds plugin to vite plugins[]
                                  │
                                  └── @vite-pwa/assets-generator reads public/snappet.svg
                                      and produces 192×192, 512×512, 512×512-maskable PNGs
                                      + apple-touch-icon at build time
public/snappet.svg ── source icon (checked in)

index.html ── new <meta> tags for theme-color and Apple PWA mode
              (manifest <link> is auto-injected by VitePWA)

src/frontend/main.tsx ── unchanged
src/frontend/App.tsx ── mounts <UpdatePrompt /> alongside the router

src/frontend/components/UpdatePrompt.tsx ── new component
              uses useRegisterSW from 'virtual:pwa-register/react' to:
                - register the SW
                - show a "New version available — Reload" banner
                - call updateSW() on click
```

## Dependencies

Add to `devDependencies`:
```bash
npm install --save-dev vite-plugin-pwa @vite-pwa/assets-generator
```

No runtime deps — `virtual:pwa-register/react` is a virtual module exposed by `vite-plugin-pwa` at build time.

## Output format

### 1. `src/frontend/vite.config.ts`

Replace with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Set VITE_BASE_PATH to match your GitHub repo name, e.g. /Snappet/
// Defaults to /Snappet/ — change this if your repo is named differently
const base = process.env.VITE_BASE_PATH ?? '/Snappet/'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Enable the SW in dev so the install flow + update banner can be
      // exercised on localhost:5173 before deploy.
      devOptions: { enabled: true, type: 'module' },
      // Auto-generate PWA icons from public/snappet.svg via
      // @vite-pwa/assets-generator using the standard preset.
      pwaAssets: {
        disabled: false,
        // config: false → use the inline `preset` below instead of looking
        // for a pwa-assets.config.* file (which we deliberately do not have).
        config: false,
        preset: 'minimal-2023',
        image: 'public/snappet.svg',
        overrideManifestIcons: true,
      },
      manifest: {
        name: 'Snappet',
        short_name: 'Snappet',
        description: 'A hub of lightweight single-page web apps.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        categories: ['productivity', 'utilities'],
        // icons array is filled in automatically by pwaAssets
      },
      workbox: {
        // Precache build output: HTML, JS, CSS, SVG, PNG, woff/woff2.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // SPA navigation fallback so deep links work offline.
        navigateFallback: `${base}index.html`,
        // Don't intercept the GH Pages 404 redirect path or the SW script
        // itself.
        navigateFallbackDenylist: [/^\/?\d{3}\.html$/, /sw\.js$/],
        cleanupOutdatedCaches: true,
        // Skip CDN-loaded assets — see research/pwa-support.md.
        // (Workbox precache is build-only by design; runtime fetches to
        // unpkg.com / jsdelivr.net just pass through to the network.)
      },
    }),
  ],
  base,
  build: {
    // pdfjs-dist is intentionally large — only loads for /doc-viewer
    chunkSizeWarningLimit: 700,
  },
})
```

### 2. `src/frontend/public/snappet.svg` (new — source icon)

A 512×512 square mark: rounded blue background with a 2×2 grid of white rounded squares, representing the hub of mini-apps. Theme blue matches the manifest `theme_color`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#2563eb"/>
  <g fill="#ffffff">
    <rect x="112" y="112" width="128" height="128" rx="24"/>
    <rect x="272" y="112" width="128" height="128" rx="24"/>
    <rect x="112" y="272" width="128" height="128" rx="24"/>
    <rect x="272" y="272" width="128" height="128" rx="24"/>
  </g>
</svg>
```

Put it at `src/frontend/public/snappet.svg`. `@vite-pwa/assets-generator` reads this and emits the 192/512/maskable PNGs + Apple touch icon during `vite build`. They land in `dist/` for deploy — no need to commit the PNGs.

### 3. `src/frontend/index.html`

Add inside `<head>`, after the existing `<meta name="viewport" …>` and before the dark-mode script (keep the dark-mode script and GH Pages SPA redirect intact):

```html
<meta name="theme-color" content="#2563eb" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Snappet" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="description" content="A hub of lightweight single-page web apps — calculators, developer tools, productivity apps. Works offline." />
<link rel="icon" type="image/svg+xml" href="/Snappet/snappet.svg" />
<!-- apple-touch-icon and manifest <link> are auto-injected by vite-plugin-pwa -->
```

(VitePWA auto-injects both `<link rel="manifest">` *and* `<link rel="apple-touch-icon">` (pointing to the generated `apple-touch-icon-180x180.png`) — only add the SVG favicon manually.)

If `VITE_BASE_PATH` is configurable, hard-coding `/Snappet/` in the icon hrefs is acceptable because they live in `public/` and inherit `base` at build time. Alternative: leave the hrefs starting with `/` and rely on VitePWA's HTML transform.

### 4. `src/frontend/components/UpdatePrompt.tsx` (new)

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.error('SW registration error:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-xl border border-gray-700 dark:border-gray-300 max-w-[calc(100vw-2rem)]"
    >
      <span className="text-sm">A new version of Snappet is available.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-200 dark:hover:text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
      >
        ✕
      </button>
    </div>
  )
}
```

### 5. `src/frontend/App.tsx`

Mount `<UpdatePrompt />` alongside the existing layout — render it as a sibling to `<Layout>` so its `fixed`-positioned banner sits above page content but isn't affected by route changes:

```tsx
import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import { routes } from './router/routes'
import HubPage from './apps/hub'

function NotFound() {
  return (
    <div className="text-center py-12 text-gray-600 dark:text-gray-400">
      404 — Page not found
    </div>
  )
}

export default function App() {
  return (
    <>
      <Layout>
        <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HubPage />} />
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={<route.component />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
      <UpdatePrompt />
    </>
  )
}
```

### 6. `src/frontend/tsconfig.json` (modify if needed)

`virtual:pwa-register/react` is a virtual module; TypeScript needs to know it exists. The plugin ships type definitions at `vite-plugin-pwa/client`. Add to `compilerOptions.types`:

```jsonc
{
  "compilerOptions": {
    // … existing options …
    "types": ["vite/client", "vite-plugin-pwa/client"]
  }
}
```

If `types` isn't currently set in tsconfig, add the array exactly as above. If it exists, append `"vite-plugin-pwa/client"`.

### 7. `src/frontend/package.json`

Append to `devDependencies` (run `npm install --save-dev vite-plugin-pwa @vite-pwa/assets-generator` rather than editing manually so the lockfile stays consistent):

```json
"@vite-pwa/assets-generator": "^0.2.6",
"vite-plugin-pwa": "^0.21.0"
```

(Pin to whatever the latest minor is when running the install — these are the floor versions known to work with vite 5.)

## Acceptance criteria

- [ ] `npm run build` completes and emits a service worker (`sw.js`) and `manifest.webmanifest` in `dist/`
- [ ] `dist/` contains generated icon PNGs (192×192, 512×512, 512×512 maskable, apple-touch-icon-180)
- [ ] Loading the deployed app in Chrome → DevTools → Application → Manifest shows all icons + correct `start_url` (`/Snappet/`) + `standalone` display
- [ ] DevTools → Application → Service Workers shows an active worker scoped to `/Snappet/`
- [ ] After install (Chrome's "Install app" affordance), the app opens in standalone mode with the icon on the OS launcher
- [ ] Going offline (DevTools throttling = Offline) and reloading the hub page still shows the app shell and the previously-loaded route chunks
- [ ] Document Viewer with a previously-OCR'd file: the page loads offline; running OCR while offline fails gracefully (CDN deps unreachable) — known limitation
- [ ] Deploy a new build → the running tab shows the "New version available — Reload" banner within ~60s
- [ ] Clicking Reload activates the new SW and refreshes the page to the new version
- [ ] No regression to the GH Pages 404→SPA redirect (deep-link to `/Snappet/tip-calculator` directly in a fresh tab still works)
- [ ] No regression to dark mode init (no flash on first paint)
- [ ] Build still passes `tsc && vite build` with no new errors

## Constraints

- **Do not break the existing GH Pages 404 redirect.** Verify `navigateFallbackDenylist` includes the 404.html pattern so Workbox doesn't try to cache or intercept it.
- **Do not precache external CDN assets.** Workbox `globPatterns` only matches local build output. Tesseract.js / pdf.js / pdf-lib continue to load over the network as today.
- **Keep `registerType: 'prompt'`** (not `'autoUpdate'`). The user should see and consent to the reload — silent updates can lose mid-session state in mini-apps.
- **TypeScript strict** — no `any`. `useRegisterSW`'s return type is fully typed.
- **Dark mode + focus-visible rings** on the UpdatePrompt banner (already done in the sample).
- **SVG icon stays the source of truth.** If the design changes, edit `public/snappet.svg` only — the PNGs regenerate on build.

## Test plan

1. `npm install` to pull the new deps.
2. `npm run dev` — devtools → Application → Service Workers should show the dev SW. Open the app, browse a few routes.
3. DevTools → Network → Offline; reload — visited pages still render.
4. `npm run build && npm run preview` — verify `dist/manifest.webmanifest`, `dist/sw.js`, `dist/workbox-*.js`, and the generated icon PNGs (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`) all exist. (SW *registration* code is inlined into the app's main JS chunk via the virtual module — no separate `registerSW.js` file.)
5. Lighthouse → PWA category: should score "Installable" green.
6. Deploy. In a separate tab, change the SW version (any source edit triggers it) and redeploy; original tab should surface the update banner within a minute.

## Next step

Run `/project:pdd-review` on the resulting diff before opening a PR.
