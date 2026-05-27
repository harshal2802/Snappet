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
        // config:false → use the inline `preset` below instead of looking for
        // a pwa-assets.config.* file.
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
        // Don't intercept the GH Pages 404 redirect path or the SW script itself.
        navigateFallbackDenylist: [/^\/?\d{3}\.html$/, /sw\.js$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base,
  build: {
    // pdfjs-dist is intentionally large — only loads for /doc-viewer
    chunkSizeWarningLimit: 700,
  },
})
