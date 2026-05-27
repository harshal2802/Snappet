# Research: PWA support for Snappet

**Date**: 2026-05-27
**Outcome**: Adopt `vite-plugin-pwa`

## Problem

Snappet is currently a regular SPA on GitHub Pages. Users can use it in the browser but can't install it as a standalone app, and the apps don't work offline despite all state being local (localStorage). Making it a PWA means:
- Installable icon on the user's home screen / app launcher (desktop + mobile)
- Works offline once visited (the entire shell + assets cached)
- Faster repeat loads via the service worker cache
- "Update available" prompt when a new version ships

## Key constraints

- **Vite + GitHub Pages deployment** — base path is `/Snappet/` (from `vite.config.ts`). The service worker scope must respect this.
- **SPA redirect dance** — `index.html` already has the GitHub Pages 404→SPA-restore script. The SW must not interfere; navigation requests should route through the SPA shell.
- **Lazy-loaded route chunks** — each mini-app is a `lazy(() => import(...))` chunk. The SW precache should include them so offline navigation works for all apps.
- **External CDN dependencies** — Document Viewer loads tesseract.js worker, tesseract WASM core, eng language model, and pdf.js worker from `cdn.jsdelivr.net` and `unpkg.com`. These are too large (≈12 MB total) to precache. They should be left to the browser's HTTP cache; the rest of the app should remain functional offline if those aren't yet cached.
- **No build pipeline changes** — must continue to work with the existing `tsc && vite build` script and GitHub Actions deploy.

## Options evaluated

### Option 1: `vite-plugin-pwa` (Adopt) — RECOMMENDED

**What**: First-party Vite plugin built on Workbox. Generates `manifest.webmanifest` from config, generates a Workbox-based service worker, precaches the build manifest, and exposes `virtual:pwa-register/react` for an update-prompt hook.

**Pros**:
- Maintained, widely adopted (used by Vitest, Element Plus, Astro starters)
- Handles SW lifecycle (skipWaiting, clientsClaim, update prompts) without us writing low-level code
- `injectManifest` mode available if we ever need custom SW logic (we don't right now)
- Auto-generates correct asset hashing for cache busting
- React entry point: `import { useRegisterSW } from 'virtual:pwa-register/react'`
- Respects Vite's `base` config — handles the `/Snappet/` prefix correctly

**Cons**:
- One more dev dependency (~2.7 MB unpacked, dev-only — not in shipped bundle)
- Workbox SW size at runtime is ~15 KB gzipped — negligible

**Effort**: Low. Plugin config + manifest object + icons + a small update-prompt component.

### Option 2: Manual SW + manifest (Build)

**What**: Hand-write `public/manifest.webmanifest`, hand-write `public/sw.js`, register from `main.tsx`.

**Pros**: Full control. No dev dependency.

**Cons**:
- Have to hand-maintain the precache list (which changes every build with Vite's hashed chunks → either bypass cache busting or write a build hook)
- Re-implement update-detection logic
- Easy to get the SW scope wrong with the `/Snappet/` base path
- Multiplies the chance of breaking the existing GH Pages SPA redirect

**Effort**: Medium-High. Reinventing what vite-plugin-pwa does.

### Option 3: Workbox CLI directly (Compose)

**What**: Use `workbox-cli` in a post-build script to generate the SW, hand-write the manifest.

**Pros**: Less magic than the plugin.

**Cons**: Loses the React register helper. We'd still need a custom build-step integration. Strict subset of what the plugin does.

**Effort**: Medium.

## Recommendation

**Adopt `vite-plugin-pwa`** in `generateSW` mode (default — uses pre-generated SW from a config) rather than `injectManifest` (custom SW source).

Reasoning:
- We don't need custom SW behavior beyond precache + offline-fallback to `index.html`
- The plugin's defaults match exactly what we need: SPA navigation fallback, precache hashed chunks, cleanup-outdated-caches
- We do need an in-app "Update available — Reload" prompt; `useRegisterSW` from `virtual:pwa-register/react` makes this a 20-line component
- Icons can be generated once (192×192, 512×512, plus a 512×512 maskable) from a single SVG using a one-time tool or `vite-plugin-pwa`'s assets generator

### Caching strategy

- **Precache** (StaleWhileRevalidate): the build output (HTML, JS chunks, CSS, fonts, app icons)
- **Runtime cache** (CacheFirst, 30-day TTL): nothing for now. External CDN scripts (tesseract.js, pdfjs, pdf-lib) are too large to precache; falling back to the HTTP cache for them keeps offline-first sane.
- **Navigation fallback**: `index.html` (so any deep-linked SPA route works offline)

### Manifest highlights

- `name`: "Snappet"
- `short_name`: "Snappet"
- `start_url`: `/Snappet/`
- `scope`: `/Snappet/`
- `display`: `standalone`
- `theme_color`: the existing primary blue (`#2563eb`)
- `background_color`: white (matches the un-darkened shell so the splash isn't black on first paint)
- `icons`: 192×192, 512×512, plus 512×512 `purpose: "maskable"`

## Decision log

Recorded in `pdd/context/decisions.md`: adopted `vite-plugin-pwa`, rejected manual SW and workbox-cli. The Document Viewer's CDN-loaded tesseract/pdfjs assets are intentionally NOT precached — too large, and HTTP cache covers the warm case.

## Next step

Proceed to `/project:pdd-plan` for phase breakdown, then `/project:pdd-prompts` to write the implementation prompt.
