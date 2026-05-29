# Implementation Plan: SEO + Google-AI / answer-engine optimization

**Created**: 2026-05-29
**Research**: `pdd/context/research/seo-aeo.md`

## Goal
Make the hub + all 20 tools discoverable on Google AND AI answer engines (which don't run
JS), without a framework migration. One branch, build-green, deploy via PR → main → Pages.

## Approach (shipped)
- **`seo/catalog.ts`** — single source of truth: each tool's path/label/description/category/
  icon + tagline, features, faqs, keywords, noindex. `router/routes.tsx` builds from it +
  a loaders map (AppRoute shape unchanged).
- **`seo/meta.ts`** — `computeMeta(path)`: title/description/canonical/OG/Twitter/robots +
  JSON-LD (hub: WebSite+Organization+ItemList; tool: WebApplication+BreadcrumbList+FAQPage).
- **`seo/useSeoHead.ts`** — runtime: mutate existing head tags on client nav (no helmet dep,
  no duplicate tags vs the prerendered head). Wired in `App.tsx`.
- **`seo/render.ts`** — pure HTML-string renderers (head + crawlable body).
- **`vite.config.ts` `seoPrerender` plugin** (closeBundle, runs last): writes one static
  `dist/<route>/index.html` per route with unique head + JSON-LD + crawlable body (h1,
  definitional sentence, features, FAQ, internal links) baked into `#root` (React replaces it
  on mount). Emits `sitemap.xml` (indexable only), `robots.txt` (allows AI crawlers), `llms.txt`.
- **`index.html`** — site-wide head defaults (stripped + replaced per-page by the prerenderer).

## Verified
- 20 static route HTML files + hub; sitemap = 20 URLs (`/example` noindex + excluded);
  exactly one title/canonical per page; JSON-LD graph present; app-boot scripts intact.
- tsc + build clean.

## Status — shipped
## Deferred / follow-ups
- 1200×630 per-tool OG images (currently reuse pwa-512x512.png).
- Submit sitemap in Google Search Console; verify domain.
- robots.txt is only honored at the domain root on GitHub Pages project pages — rely on
  per-page meta robots + GSC sitemap submission.
- Optional: real FAQ/About pages, per-tool "Last updated" dates.
