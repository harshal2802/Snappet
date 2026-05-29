import { useEffect } from 'react'
import { computeMeta } from './meta'

// Keeps the document <head> in sync during client-side navigation. It MUTATES the
// existing tags (the same ones the prerenderer baked in) rather than appending, so
// there are never duplicate titles/canonicals. JSON-LD is intentionally left to the
// static per-route HTML (it matters for crawlers, which fetch each URL fresh).
function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function useSeoHead(path: string): void {
  useEffect(() => {
    const m = computeMeta(path)
    document.title = m.title
    setMeta('name', 'description', m.description)
    setMeta('name', 'robots', m.robots)
    setLink('canonical', m.canonical)
    setMeta('property', 'og:title', m.ogTitle)
    setMeta('property', 'og:description', m.ogDescription)
    setMeta('property', 'og:url', m.canonical)
    setMeta('property', 'og:type', m.ogType)
    setMeta('property', 'og:image', m.ogImage)
    setMeta('property', 'og:site_name', 'Snappet')
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', m.ogTitle)
    setMeta('name', 'twitter:description', m.ogDescription)
    setMeta('name', 'twitter:image', m.ogImage)
  }, [path])
}
