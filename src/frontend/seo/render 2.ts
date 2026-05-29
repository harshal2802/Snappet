// Pure HTML-string renderers used by the build-time prerender plugin. No DOM/React.
import { SITE, catalog } from './catalog'
import { computeMeta, pageUrl } from './meta'
import type { PageMeta } from './meta'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function metaTag(attr: 'name' | 'property', key: string, content: string): string {
  return `<meta ${attr}="${key}" content="${esc(content)}">`
}

function jsonLdScript(obj: Record<string, unknown>): string {
  // Escape "<" so a "</script>" inside string values can't break out of the tag.
  const json = JSON.stringify(obj).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}

// All <head> tags for a page, as a single HTML string (newline-indented).
export function renderHeadTags(meta: PageMeta): string {
  const parts = [
    `<title>${esc(meta.title)}</title>`,
    metaTag('name', 'description', meta.description),
    metaTag('name', 'robots', meta.robots),
    `<link rel="canonical" href="${esc(meta.canonical)}">`,
    metaTag('property', 'og:site_name', SITE.name),
    metaTag('property', 'og:title', meta.ogTitle),
    metaTag('property', 'og:description', meta.ogDescription),
    metaTag('property', 'og:type', meta.ogType),
    metaTag('property', 'og:url', meta.canonical),
    metaTag('property', 'og:image', meta.ogImage),
    metaTag('name', 'twitter:card', 'summary_large_image'),
    metaTag('name', 'twitter:title', meta.ogTitle),
    metaTag('name', 'twitter:description', meta.ogDescription),
    metaTag('name', 'twitter:image', meta.ogImage),
    ...meta.jsonLd.map(jsonLdScript),
  ]
  return parts.join('\n    ')
}

const WRAP_OPEN =
  '<main style="max-width:48rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#111">'
const WRAP_CLOSE = '</main>'

function ul(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
}

// Crawlable body content baked into <div id="root">…</div>. React replaces it on
// mount for JS users; non-JS crawlers (incl. AI engines) read it as the page content.
export function renderBodyContent(meta: PageMeta): string {
  if (meta.isHub) {
    const links = catalog
      .filter((a) => !a.noindex)
      .map(
        (a) =>
          `<a href="${pageUrl(a.path)}">${esc(a.label)}</a> — ${esc(a.description)}`,
      )
    return (
      WRAP_OPEN +
      `<h1>${esc(SITE.name)} — Free Browser Tools</h1>` +
      `<p>${esc(SITE.description)}</p>` +
      `<h2>All tools</h2>` +
      ul(links) +
      `<p>Loading Snappet…</p>` +
      WRAP_CLOSE
    )
  }

  const app = meta.app!
  const related = catalog
    .filter((a) => !a.noindex && a.category === app.category && a.path !== app.path)
    .slice(0, 5)
    .map((a) => `<a href="${pageUrl(a.path)}">${esc(a.label)}</a>`)

  let html =
    WRAP_OPEN +
    `<p><a href="${SITE.url}/">← All ${esc(SITE.name)} tools</a></p>` +
    `<h1>${esc(app.label)}</h1>` +
    `<p>${esc(app.tagline ?? app.description)}</p>`

  if (app.features?.length) {
    html += `<h2>Features</h2>` + ul(app.features.map(esc))
  }
  if (app.faqs?.length) {
    html +=
      `<h2>Frequently asked questions</h2>` +
      app.faqs
        .map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`)
        .join('')
  }
  if (related.length) {
    html += `<h2>More ${esc(app.category)} tools</h2>` + ul(related)
  }
  html += `<p>Loading the ${esc(app.label)}…</p>` + WRAP_CLOSE
  return html
}

// Convenience: full per-path render inputs for the prerenderer.
export function renderForPath(path: string): {
  meta: PageMeta
  head: string
  body: string
} {
  const meta = computeMeta(path)
  return { meta, head: renderHeadTags(meta), body: renderBodyContent(meta) }
}
