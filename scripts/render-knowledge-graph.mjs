/*
 * Render static PNG screenshots of the Snappet Knowledge Graph from the SAME
 * data.js the live page uses, so the images never drift from the real model.
 *
 * Usage:  node scripts/render-knowledge-graph.mjs
 * Output: docs/screenshots/knowledge-graph.png        (dark)
 *         docs/screenshots/knowledge-graph-light.png  (light)
 *
 * Requires @resvg/resvg-js (a dev-only render tool — not a runtime dependency).
 * If it isn't installed it is a no-op with a friendly message; the committed
 * PNGs remain valid until the model changes.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// data.js is dual-export (browser + CommonJS). The frontend package marks .js as
// ESM, so load it in a tiny sandbox that supplies `module` + `window`.
const dataSrc = readFileSync(join(ROOT, 'src/frontend/public/knowledge-graph/data.js'), 'utf8')
const sandbox = { module: { exports: {} }, window: {} }
new Function('module', 'window', dataSrc)(sandbox.module, sandbox.window)
const { nodes: RAW_NODES, edges: RAW_EDGES } = sandbox.module.exports

const TYPE_META = {
  root:     { color: '#f4c20d', label: 'Hub (root)',     r: 22 },
  shell:    { color: '#4f8cff', label: 'App shell',      r: 15 },
  hub:      { color: '#29c2a3', label: 'Hub UI',         r: 13 },
  app:      { color: '#a78bfa', label: 'Mini-app',       r: 13 },
  hook:     { color: '#ff8f5e', label: 'Hook',           r: 11 },
  lib:      { color: '#ff6b9d', label: 'Library',        r: 11 },
  seo:      { color: '#36c6f0', label: 'SEO / AEO',      r: 11 },
  build:    { color: '#8aa0c8', label: 'Build / deploy', r: 13 },
  external: { color: '#6b7a99', label: 'Dependency',     r: 10 },
  pdd:      { color: '#c0e060', label: 'Product brain',  r: 12 },
}

// ── Canvas geometry ────────────────────────────────────────────────────────
const WIDTH = 1680
const HEIGHT = 1000
const TOOLBAR_H = 54
const SIDEBAR_W = 240
const GX = SIDEBAR_W
const GY = TOOLBAR_H
const GW = WIDTH - SIDEBAR_W
const GH = HEIGHT - TOOLBAR_H

const THEMES = {
  dark:  { bg: '#0b1020', bgSoft: '#121a30', panel: '#141d33', panel2: '#1b2746', border: '#243352', text: '#e8edf7', muted: '#93a1c4', accent: '#4f8cff', edge: '#46588a', stroke: '#0b1020' },
  light: { bg: '#f5f7fc', bgSoft: '#eef2fb', panel: '#ffffff', panel2: '#f1f5ff', border: '#d8e0f2', text: '#1a2540', muted: '#5a688a', accent: '#2563eb', edge: '#a9b7d8', stroke: '#ffffff' },
}

// ── Build node + adjacency model ─────────────────────────────────────────────
const nodeById = new Map()
const nodes = RAW_NODES.map((n) => {
  const m = { ...n, x: 0, y: 0, vx: 0, vy: 0, r: (TYPE_META[n.type] || {}).r || 11 }
  nodeById.set(n.id, m)
  return m
})
const edges = RAW_EDGES.filter((e) => nodeById.has(e.s) && nodeById.has(e.t)).map((e) => ({
  ...e, source: nodeById.get(e.s), target: nodeById.get(e.t),
}))

// ── Deterministic force layout (mirrors graph.js physics) ───────────────────
let seed = 20260602
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const cx = GX + GW / 2, cy = GY + GH / 2
nodes.forEach((n) => {
  const a = rng() * Math.PI * 2
  const rad = 80 + rng() * Math.min(GW, GH) * 0.36
  n.x = cx + Math.cos(a) * rad
  n.y = cy + Math.sin(a) * rad
})
nodeById.get('snappet').x = cx
nodeById.get('snappet').y = cy

const root = nodeById.get('snappet')
let alpha = 1
for (let iter = 0; iter < 900; iter++) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      let dx = a.x - b.x, dy = a.y - b.y
      let d2 = dx * dx + dy * dy || 0.01
      const d = Math.sqrt(d2)
      const f = (5400 * alpha) / d2
      const fx = (dx / d) * f, fy = (dy / d) * f
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }
  }
  edges.forEach((e) => {
    const a = e.source, b = e.target
    let dx = b.x - a.x, dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01
    const f = (d - 115) * 0.02 * alpha
    const fx = (dx / d) * f, fy = (dy / d) * f
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  })
  nodes.forEach((n) => {
    n.vx += (cx - n.x) * 0.0016 * alpha
    n.vy += (cy - n.y) * 0.0016 * alpha
    n.vx *= 0.85; n.vy *= 0.85
    n.x += n.vx; n.y += n.vy
  })
  // Pin the root at center so the graph radiates from the hub.
  root.x = cx; root.y = cy; root.vx = root.vy = 0
  alpha *= 0.993
}
// De-overlap pass.
for (let pass = 0; pass < 120; pass++) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      const dx = a.x - b.x, dy = a.y - b.y
      const min = a.r + b.r + 46
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      if (d < min) {
        const push = ((min - d) / d) * 0.5
        a.x += dx * push; a.y += dy * push; b.x -= dx * push; b.y -= dy * push
      }
    }
  }
  root.x = cx; root.y = cy
}
// Clamp into the graph area (with margin for labels).
const M = 90
nodes.forEach((n) => {
  n.x = Math.max(GX + M, Math.min(WIDTH - 40, n.x))
  n.y = Math.max(GY + 40, Math.min(HEIGHT - 40, n.y))
})

// ── SVG helpers ──────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const EDGE_DASH = { persists: '4 3', deploys: '1 4' }

function buildSvg(theme) {
  const c = THEMES[theme]
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`)
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${c.bg}"/>`)

  // Edges
  edges.forEach((e) => {
    const dash = EDGE_DASH[e.type] ? ` stroke-dasharray="${EDGE_DASH[e.type]}"` : ''
    parts.push(`<line x1="${e.source.x.toFixed(1)}" y1="${e.source.y.toFixed(1)}" x2="${e.target.x.toFixed(1)}" y2="${e.target.y.toFixed(1)}" stroke="${c.edge}" stroke-width="1.2" opacity="0.5"${dash}/>`)
  })
  // Edge labels (only the most meaningful, to avoid clutter)
  edges.filter((e) => e.label).forEach((e) => {
    const mx = (e.source.x + e.target.x) / 2, my = (e.source.y + e.target.y) / 2 - 3
    parts.push(label(esc(e.label), mx, my, 9, c.muted, c.bg, 'middle'))
  })
  // Nodes
  nodes.forEach((n) => {
    const color = (TYPE_META[n.type] || {}).color || '#888'
    parts.push(`<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r}" fill="${color}" stroke="${c.stroke}" stroke-width="2"/>`)
    parts.push(label(esc(n.label), n.x, n.y + n.r + 12, 11, c.text, c.bg, 'middle', 600))
  })

  // Toolbar chrome
  parts.push(`<rect x="0" y="0" width="${WIDTH}" height="${TOOLBAR_H}" fill="${c.bgSoft}"/>`)
  parts.push(`<line x1="0" y1="${TOOLBAR_H}" x2="${WIDTH}" y2="${TOOLBAR_H}" stroke="${c.border}" stroke-width="1"/>`)
  parts.push(`<rect x="18" y="15" width="26" height="26" rx="7" fill="${c.accent}"/>`)
  parts.push(`<text x="31" y="33" font-size="15" fill="#fff" text-anchor="middle">◆</text>`)
  parts.push(`<text x="54" y="33" font-size="15" font-weight="700" fill="${c.text}">Snappet KG</text>`)
  parts.push(`<text x="158" y="33" font-size="13" fill="${c.muted}">· codebase map</text>`)
  // fake search
  parts.push(`<rect x="300" y="13" width="300" height="28" rx="9" fill="${c.panel}" stroke="${c.border}"/>`)
  parts.push(`<text x="318" y="32" font-size="13" fill="${c.muted}">⌕  Search nodes…  ( / )</text>`)
  // layout seg
  const segX = WIDTH - 470
  parts.push(`<rect x="${segX}" y="13" width="220" height="28" rx="9" fill="${c.panel}" stroke="${c.border}"/>`)
  parts.push(`<rect x="${segX}" y="13" width="73" height="28" rx="9" fill="${c.accent}"/>`)
  parts.push(`<text x="${segX + 36}" y="32" font-size="12.5" font-weight="600" fill="#fff" text-anchor="middle">Force</text>`)
  parts.push(`<text x="${segX + 118}" y="32" font-size="12.5" font-weight="600" fill="${c.muted}" text-anchor="middle">Hierarchy</text>`)
  parts.push(`<text x="${segX + 190}" y="32" font-size="12.5" font-weight="600" fill="${c.muted}" text-anchor="middle">Clusters</text>`)
  // buttons
  ;['↔ Trace path', '⤓ PNG', '☀︎', '?'].forEach((t, i) => {
    const widths = [96, 64, 34, 34]
    let bx = WIDTH - 18 - widths.slice(i).reduce((a, b) => a + b + 8, 0) + 8
    parts.push(`<rect x="${bx}" y="13" width="${widths[i]}" height="28" rx="9" fill="${c.panel}" stroke="${c.border}"/>`)
    parts.push(`<text x="${bx + widths[i] / 2}" y="32" font-size="12.5" font-weight="600" fill="${c.text}" text-anchor="middle">${t}</text>`)
  })

  // Sidebar chrome
  parts.push(`<rect x="0" y="${TOOLBAR_H}" width="${SIDEBAR_W}" height="${HEIGHT - TOOLBAR_H}" fill="${c.panel}"/>`)
  parts.push(`<line x1="${SIDEBAR_W}" y1="${TOOLBAR_H}" x2="${SIDEBAR_W}" y2="${HEIGHT}" stroke="${c.border}" stroke-width="1"/>`)
  const typeCounts = {}
  nodes.forEach((n) => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1 })
  let ly = TOOLBAR_H + 28
  parts.push(`<text x="16" y="${ly}" font-size="11" letter-spacing="1" fill="${c.muted}">NODE TYPES</text>`)
  ly += 16
  Object.keys(TYPE_META).forEach((type) => {
    if (!typeCounts[type]) return
    parts.push(`<rect x="16" y="${ly - 9}" width="12" height="12" rx="4" fill="${TYPE_META[type].color}"/>`)
    parts.push(`<text x="36" y="${ly}" font-size="12.5" fill="${c.text}">${TYPE_META[type].label}</text>`)
    parts.push(`<text x="${SIDEBAR_W - 16}" y="${ly}" font-size="11" fill="${c.muted}" text-anchor="end">${typeCounts[type]}</text>`)
    ly += 26
  })
  ly += 14
  parts.push(`<text x="16" y="${ly}" font-size="11" letter-spacing="1" fill="${c.muted}">SCALE</text>`)
  ly += 18
  parts.push(`<text x="16" y="${ly}" font-size="12" fill="${c.muted}">${nodes.length} nodes · ${edges.length} edges</text>`)

  // Caption
  parts.push(`<text x="${SIDEBAR_W + 16}" y="${HEIGHT - 16}" font-size="12" fill="${c.muted}">Snappet codebase — apps, infrastructure, dependencies &amp; the product brain, wired by how they connect.</text>`)

  parts.push('</svg>')
  return parts.join('\n')
}

function label(text, x, y, size, fill, stroke, anchor, weight) {
  const w = weight ? ` font-weight="${weight}"` : ''
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${w} stroke="${stroke}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${text}</text>`
}

// ── Rasterize ────────────────────────────────────────────────────────────────
const outDir = join(ROOT, 'docs/screenshots')
mkdirSync(outDir, { recursive: true })

let Resvg
try {
  ;({ Resvg } = require(join(ROOT, 'src/frontend/node_modules/@resvg/resvg-js')))
} catch {
  try { ({ Resvg } = require('@resvg/resvg-js')) } catch {}
}

for (const [theme, file] of [['dark', 'knowledge-graph.png'], ['light', 'knowledge-graph-light.png']]) {
  const svg = buildSvg(theme)
  writeFileSync(join(outDir, file.replace('.png', '.svg')), svg)
  if (Resvg) {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng()
    writeFileSync(join(outDir, file), png)
    console.log(`✓ ${file} (${(png.length / 1024).toFixed(0)} KB)`)
  } else {
    console.log(`• wrote ${file.replace('.png', '.svg')} (install @resvg/resvg-js to rasterize to PNG)`)
  }
}
