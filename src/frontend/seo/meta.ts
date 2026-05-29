// Pure SEO metadata computation shared by the runtime head updater and the
// build-time prerenderer. No React / DOM access here.
import { SITE, catalog, catalogByPath } from './catalog'
import type { AppMeta } from './catalog'

export interface PageMeta {
  path: string
  isHub: boolean
  app?: AppMeta
  title: string
  description: string
  canonical: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogType: string
  robots: string
  // JSON-LD graph objects (each becomes one <script type="application/ld+json">)
  jsonLd: Array<Record<string, unknown>>
}

export function pageUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE.url}/`
  const clean = path.replace(/^\/+|\/+$/g, '')
  return `${SITE.url}/${clean}/`
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}

function applicationCategory(app: AppMeta): string {
  switch (app.category) {
    case 'Developer Tools':
      return 'DeveloperApplication'
    case 'Productivity':
      return 'BusinessApplication'
    case 'Creative':
      return 'MultimediaApplication'
    case 'Health':
      return 'HealthApplication'
    case 'Calculators':
    case 'Utilities':
    default:
      return 'UtilitiesApplication'
  }
}

function hubJsonLd(): Array<Record<string, unknown>> {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.description,
  }
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: SITE.ogImage,
  }
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Snappet tools',
    itemListElement: catalog
      .filter((a) => !a.noindex)
      .map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: pageUrl(a.path),
        name: a.label,
      })),
  }
  return [website, org, list]
}

function toolJsonLd(app: AppMeta): Array<Record<string, unknown>> {
  const url = pageUrl(app.path)
  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${app.label} — Snappet`,
    url,
    description: app.tagline ?? app.description,
    applicationCategory: applicationCategory(app),
    operatingSystem: 'Web',
    browserRequirements: 'Requires a modern web browser with JavaScript.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true,
    ...(app.features?.length ? { featureList: app.features } : {}),
    publisher: { '@type': 'Organization', name: SITE.name, url: `${SITE.url}/` },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
      { '@type': 'ListItem', position: 2, name: app.label, item: url },
    ],
  }
  const out: Array<Record<string, unknown>> = [webApp, breadcrumb]
  if (app.faqs?.length) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: app.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
  }
  return out
}

export function computeMeta(path: string): PageMeta {
  const normalized = path.replace(/\/+$/, '') || '/'
  const app = catalogByPath[normalized]

  if (!app) {
    // Hub (or unknown path → treat as hub identity).
    const title = `${SITE.name} — 20+ Free Browser Tools, No Sign-Up`
    return {
      path: '/',
      isHub: true,
      title,
      description: SITE.description,
      canonical: `${SITE.url}/`,
      ogTitle: title,
      ogDescription: SITE.description,
      ogImage: SITE.ogImage,
      ogType: 'website',
      robots: 'index,follow,max-image-preview:large',
      jsonLd: hubJsonLd(),
    }
  }

  const title = clamp(`${app.label} — Free Online Tool | ${SITE.name}`, 65)
  const description = clamp(app.tagline ?? app.description, 158)
  const canonical = pageUrl(app.path)
  return {
    path: app.path,
    isHub: false,
    app,
    title,
    description,
    canonical,
    ogTitle: `${app.label} — Free Online`,
    ogDescription: description,
    ogImage: SITE.ogImage,
    ogType: 'website',
    robots: app.noindex
      ? 'noindex,follow'
      : 'index,follow,max-image-preview:large',
    jsonLd: app.noindex ? [] : toolJsonLd(app),
  }
}
