# Research: SEO + Google-AI / answer-engine optimization (Snappet)

**Date**: 2026-05-29
**Scope**: Make the whole hub (20 tools + landing) discoverable on Google **and** AI answer
engines (AI Overviews, ChatGPT, Perplexity, Claude). Vite + React SPA on GitHub Pages
(`https://harshal2802.github.io/Snappet/`, project page, base `/Snappet/`).

## Hard findings (drive the design)
1. **AI crawlers don't run JavaScript.** GPTBot/ClaudeBot/PerplexityBot fetch text/HTML only;
   only Googlebot renders JS. A client-rendered SPA is therefore **invisible to AI engines**
   unless real HTML content ships in the document.
2. **The GitHub Pages `404.html` SPA-redirect returns a real HTTP 404** for every non-root
   route before the JS redirect — a soft-404 liability. Real prerendered `/<route>/index.html`
   files remove that for indexable pages.
3. **Conclusion → prerender one static HTML file per route at build time**, each with a unique
   `<head>` (title/description/canonical/OG/Twitter), JSON-LD, and **crawlable body content**
   (h1 + definitional sentence + features + FAQ + internal links). This is the single highest-
   leverage change and works on static hosting with no SSR/framework migration.
4. Client-side head updates are still useful (browser tab + Googlebot's render + client nav),
   but **insufficient alone** for AI/social scrapers.

## Approach (chosen — no framework migration)
- **Single source of truth**: `seo/catalog.ts` (pure data: path, label, description, category,
  icon + SEO extras: tagline, features, faqs, keywords). `router/routes.tsx` builds its
  `routes` from the catalog + a `loaders` map (keeps `AppRoute` shape identical).
- **`seo/meta.ts`** (pure): `computeMeta(path)` → title, description, canonical, OG/Twitter,
  breadcrumb, and JSON-LD objects. Shared by runtime + prerender.
- **Runtime** `seo/useSeoHead.ts`: on route change, **mutate existing** head tags in place
  (title, description, canonical, og:*, twitter:*) — no react-helmet dependency, so no
  duplicate-tag issues against the prerendered head (createRoot replaces #root, doesn't hydrate).
- **Build-time** Vite plugin `seoPrerender` (closeBundle): clone built `index.html`; for the hub
  and every tool write `dist/<slug>/index.html` with injected head + JSON-LD + body content;
  also emit `sitemap.xml`, `robots.txt`, `llms.txt`.

## Structured data
- **Hub**: `WebSite` + `Organization` + `ItemList` of tools.
- **Each tool**: `WebApplication` (applicationCategory, operatingSystem: Web, offers price 0,
  isAccessibleForFree, featureList) + `BreadcrumbList` + `FAQPage` (when FAQs present).
- SearchAction/sitelinks-searchbox deprecated (Nov 2024) → skipped.

## AEO/GEO content
Lead each tool page with a definitional "X is a free browser tool that…" sentence; clear
`<h1>`/`<h2>`; 3–5 features; 3 genuine FAQs (→ `FAQPage`); internal links; "works offline,
no sign-up, free" value props. `llms.txt` added as cheap insurance (emerging, unproven).

## Crawl infra / caveats
- Canonical = absolute, includes `/Snappet/`, **trailing slash**; `og:url` identical.
- `robots.txt` + `sitemap.xml` emitted. **Caveat**: robots.txt is only honored at the domain
  root (`harshal2802.github.io/robots.txt`), not under `/Snappet/`; so per-page
  `<meta name="robots">` is the reliable lever and the sitemap should be submitted in GSC.
  We allow all bots incl. GPTBot/ClaudeBot/PerplexityBot/Google-Extended (we WANT citations).
- Keep `404.html` only as a genuine fallback; real routes now have their own files (GitHub
  Pages auto-redirects `/x` → `/x/`).
- OG image: reuse the PWA-generated `pwa-512x512.png` (square; no 1200×630 generator in scope).

Sources captured in the research pass (Google JS-SEO docs; GPTBot 500M-fetch JS analysis;
spa-github-pages 404 caveat; schema.org/Google structured-data docs; AEO/GEO guides; Vike/
vite-react-ssg docs).
