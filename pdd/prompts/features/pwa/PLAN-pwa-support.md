# Implementation Plan: PWA Support

**Created**: 2026-05-27
**Complexity**: Low–Medium
**Estimated prompts**: 1

## Summary

Make Snappet installable and offline-capable as a PWA by adopting `vite-plugin-pwa` in its default `generateSW` mode. One prompt covers: plugin install, Vite config, web app manifest, icon generation, HTML meta tags, and an in-app "Update available" prompt. No application logic changes — purely build infra + a small UI component.

Research: see `pdd/context/research/pwa-support.md`. Decision logged in `pdd/context/decisions.md`.

## Phases

### Phase 1 — Wire up vite-plugin-pwa end-to-end

**Produces**:
- `vite-plugin-pwa` (and `@vite-pwa/assets-generator`) added to `devDependencies`
- `vite.config.ts` updated with `VitePWA({...})` plugin including the full manifest, workbox options, and `pwaAssets` config
- `public/snappet.svg` source icon checked in
- Generated PWA icons in `public/` (192×192, 512×512, 512×512 maskable, plus Apple touch icon)
- `index.html` updated with PWA meta tags (`theme-color`, Apple `mobile-web-app-capable`, etc.) and the manifest `<link>`
- `src/frontend/components/UpdatePrompt.tsx` — a small banner that surfaces when the SW reports an update available, with a "Reload" button
- `UpdatePrompt` wired into `App.tsx`
- SW registered via the plugin's `virtual:pwa-register/react` helper

**Depends on**: nothing (pure additive)

**Risk**: Low. Plugin is stable; the one place to get wrong is the `base: '/Snappet/'` interaction with the SW scope — vite-plugin-pwa handles this correctly out of the box, but the prompt has to call it out so the implementer doesn't override it.

**Prompt**: `pdd/prompts/features/pwa/17-pwa-support.md`

## Risks & Unknowns

- **GitHub Pages base path** — `vite.config.ts` reads `VITE_BASE_PATH` env var (default `/Snappet/`). The SW scope and manifest `start_url`/`scope` must match. Plugin defaults pick this up from `base`; prompt makes it explicit.
- **Existing SPA redirect** — `index.html` has the GH Pages 404→SPA-restore script. The SW must not cache 404s; default Workbox `navigateFallbackDenylist` is fine since we're navigating only within scope.
- **External CDN dependencies** (tesseract.js, pdfjs worker, pdf-lib) — intentionally not precached (per research). Document Viewer's OCR needs online for the first use per machine. Worth a brief note in the user-facing privacy line or release notes; not blocking.
- **Service worker on `localhost:5173`** — Vite dev server serves the SW with `devOptions.enabled: true` if requested. The prompt enables this so users can test the install flow locally before deploy.

## Decisions Needed

None new — all settled in research / decisions.md. The prompt directly encodes them.

## Why one phase instead of many

Each candidate sub-phase (icons / config / update prompt) is unusable on its own:
- Icons without the manifest reference don't appear in the install prompt.
- The manifest without the SW doesn't make the app offline-installable.
- The update prompt without the SW does nothing.

Splitting them would just multiply the round-trips with no testable artifact in between. One cohesive prompt is the honest decomposition.

## Next step

`/project:pdd-prompts` to write `17-pwa-support.md`.
