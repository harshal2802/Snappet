import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { catalog, SITE } from './seo/catalog'
import { renderForPath } from './seo/render'
import { pageUrl } from './seo/meta'

// Set VITE_BASE_PATH to match your GitHub repo name, e.g. /Snappet/
// Defaults to /Snappet/ — change this if your repo is named differently
const base = process.env.VITE_BASE_PATH ?? '/Snappet/'

// Build-time SEO/AEO prerender: write one real static HTML file per route with a
// unique <head> + JSON-LD + crawlable body, plus sitemap.xml / robots.txt / llms.txt.
// This is what makes the SPA visible to Google AND to AI crawlers (which don't run JS).
function seoPrerender(): Plugin {
  return {
    name: 'snappet-seo-prerender',
    apply: 'build',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist')
      let template: string
      try {
        template = readFileSync(join(dist, 'index.html'), 'utf8')
      } catch {
        this.warn('seo-prerender: dist/index.html not found; skipping')
        return
      }
      const today = new Date().toISOString().slice(0, 10)

      const buildPage = (path: string): string => {
        const { head, body } = renderForPath(path)
        let html = template
        // Strip the template's default head tags that we set per-page, so the
        // generated file has exactly ONE title/description/canonical/OG/Twitter
        // (a conflicting second canonical would confuse crawlers).
        html = html
          .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
          .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
          .replace(/<meta\s+name="robots"[^>]*>\s*/gi, '')
          .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
          .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
          .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
        // Inject our head right before </head>.
        html = html.replace(/<\/head>/i, `    ${head}\n  </head>`)
        // Bake crawlable content into the React mount point (React replaces it on load).
        html = html.replace(
          /<div id="root">\s*<\/div>/i,
          `<div id="root">${body}</div>`,
        )
        return html
      }

      // Hub (overwrite dist/index.html) + every tool route.
      writeFileSync(join(dist, 'index.html'), buildPage('/'))
      const indexable = catalog.filter((a) => !a.noindex)
      for (const app of catalog) {
        const slug = app.path.replace(/^\/+/, '')
        const dir = join(dist, slug)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'index.html'), buildPage(app.path))
      }

      // sitemap.xml (indexable routes only)
      const urls = ['/', ...indexable.map((a) => a.path)]
      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (p) =>
              `  <url><loc>${pageUrl(p)}</loc><lastmod>${today}</lastmod>` +
              `<changefreq>monthly</changefreq></url>`,
          )
          .join('\n') +
        `\n</urlset>\n`
      writeFileSync(join(dist, 'sitemap.xml'), sitemap)

      // robots.txt — allow everyone incl. AI crawlers (we want citations).
      const robots =
        [
          'User-agent: *',
          'Allow: /',
          '',
          ...['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Bingbot'].flatMap(
            (b) => [`User-agent: ${b}`, 'Allow: /', ''],
          ),
          `Sitemap: ${SITE.url}/sitemap.xml`,
          '',
        ].join('\n')
      writeFileSync(join(dist, 'robots.txt'), robots)

      // llms.txt — curated index for AI engines (emerging standard).
      const llms =
        `# ${SITE.name}\n> ${SITE.description}\n\n## Tools\n` +
        indexable
          .map((a) => `- [${a.label}](${pageUrl(a.path)}): ${a.tagline ?? a.description}`)
          .join('\n') +
        '\n'
      writeFileSync(join(dist, 'llms.txt'), llms)

      this.info?.(
        `seo-prerender: wrote ${catalog.length + 1} HTML pages + sitemap/robots/llms`,
      )
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: a new build activates on the next page load (skipWaiting +
      // clientsClaim) instead of waiting for a manual "Reload" tap — so deploys
      // reach users without the stale-cache friction.
      registerType: 'autoUpdate',
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
        // Defensive: keep the large board snapshots + sql.js WASM out of the
        // precache even if the allowlist above is ever widened. They're fetched
        // lazily by the Board Explorer (see apps/board-explorer/db.ts).
        globIgnores: ['**/board-data/**', '**/sql-wasm.wasm'],
        // SPA navigation fallback so deep links work offline.
        navigateFallback: `${base}index.html`,
        // Don't intercept the GH Pages 404 redirect path or the SW script itself.
        navigateFallbackDenylist: [/^\/?\d{3}\.html$/, /sw\.js$/],
        cleanupOutdatedCaches: true,
      },
    }),
    // Must run last so its closeBundle fires after the build + PWA output exist.
    seoPrerender(),
  ],
  base,
  build: {
    // pdfjs-dist is intentionally large — only loads for /doc-viewer
    chunkSizeWarningLimit: 700,
  },
})
