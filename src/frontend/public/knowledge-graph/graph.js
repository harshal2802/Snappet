/*
 * Snappet Knowledge Graph — engine.
 *
 * Dependency-free SVG renderer: force / hierarchy / cluster layouts, fuzzy
 * search, click-to-focus, neighbor detail panel, BFS path tracing, type /
 * category / layer filters, zoom + pan + drag, deep-linking, PNG export, and a
 * light/dark theme toggle. Reads window.KG_DATA from data.js.
 */
(function () {
  'use strict'

  const { nodes: RAW_NODES, edges: RAW_EDGES } = window.KG_DATA

  // ── Type metadata (color must match the CSS palette + render script) ─────
  const TYPE_META = {
    root:     { color: '#f4c20d', label: 'Hub (root)',    r: 22 },
    shell:    { color: '#4f8cff', label: 'App shell',     r: 15 },
    hub:      { color: '#29c2a3', label: 'Hub UI',        r: 13 },
    app:      { color: '#a78bfa', label: 'Mini-app',      r: 13 },
    hook:     { color: '#ff8f5e', label: 'Hook',          r: 11 },
    lib:      { color: '#ff6b9d', label: 'Library',       r: 11 },
    seo:      { color: '#36c6f0', label: 'SEO / AEO',     r: 11 },
    build:    { color: '#8aa0c8', label: 'Build / deploy', r: 13 },
    external: { color: '#6b7a99', label: 'Dependency',    r: 10 },
    pdd:      { color: '#c0e060', label: 'Product brain', r: 12 },
  }
  const EDGE_CLASS = { persists: 'persist', deploys: 'deploy' }

  // ── State ────────────────────────────────────────────────────────────────
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const nodeById = new Map()
  const nodes = RAW_NODES.map((n) => {
    const m = { ...n, x: 0, y: 0, vx: 0, vy: 0, pinned: false, r: (TYPE_META[n.type] || {}).r || 11 }
    nodeById.set(n.id, m)
    return m
  })
  const edges = RAW_EDGES.filter((e) => nodeById.has(e.s) && nodeById.has(e.t)).map((e) => ({
    ...e,
    source: nodeById.get(e.s),
    target: nodeById.get(e.t),
  }))

  // Adjacency (undirected) for neighbor lookup + path tracing.
  const adj = new Map()
  nodes.forEach((n) => adj.set(n.id, []))
  edges.forEach((e) => {
    adj.get(e.s).push({ id: e.t, edge: e })
    adj.get(e.t).push({ id: e.s, edge: e })
  })

  let layout = 'force'
  let transform = { x: 0, y: 0, k: 1 }
  let selectedId = null
  const hidden = { type: new Set(), category: new Set(), layer: new Set() }
  let pathMode = false
  let pathFrom = null

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id)
  const svg = $('graph')
  const W = () => svg.clientWidth
  const H = () => svg.clientHeight

  const gZoom = el('g')
  const gEdges = el('g')
  const gEdgeLabels = el('g')
  const gNodes = el('g')
  gZoom.append(gEdges, gEdgeLabels, gNodes)
  svg.append(gZoom)

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag)
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k])
    return e
  }

  // ── Render the SVG elements (created once, positioned each tick) ─────────
  const edgeEls = edges.map((e) => {
    const p = el('path', { class: 'edge ' + (EDGE_CLASS[e.type] || '') })
    gEdges.appendChild(p)
    let lbl = null
    if (e.label) {
      lbl = el('text', { class: 'edge-label', 'text-anchor': 'middle' })
      lbl.textContent = e.label
      gEdgeLabels.appendChild(lbl)
    }
    return { e, p, lbl }
  })

  const nodeEls = nodes.map((n) => {
    const g = el('g', { class: 'node', 'data-id': n.id })
    const c = el('circle', { r: n.r, fill: (TYPE_META[n.type] || {}).color || '#888' })
    const t = el('text', { x: 0, y: n.r + 12, 'text-anchor': 'middle' })
    t.textContent = n.label
    g.append(c, t)
    gNodes.appendChild(g)
    g.addEventListener('pointerdown', (ev) => onNodePointerDown(ev, n))
    return { n, g, c, t }
  })

  // ── Layout: targets for hierarchy + cluster, physics for force ───────────
  // Seeded RNG so the force layout is reproducible between loads.
  let seed = 20260602
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

  function bfsDepths(rootId) {
    const depth = new Map([[rootId, 0]])
    const q = [rootId]
    while (q.length) {
      const id = q.shift()
      for (const { id: nb } of adj.get(id)) {
        if (!depth.has(nb)) { depth.set(nb, depth.get(id) + 1); q.push(nb) }
      }
    }
    nodes.forEach((n) => { if (!depth.has(n.id)) depth.set(n.id, 5) })
    return depth
  }

  let targets = null // Map id -> {x,y} or null in force mode

  function computeTargets() {
    if (layout === 'force') { targets = null; return }
    targets = new Map()
    const w = W(), h = H()
    if (layout === 'hierarchy') {
      const depth = bfsDepths('snappet')
      const byLayer = {}
      nodes.forEach((n) => { (byLayer[depth.get(n.id)] ||= []).push(n) })
      const layers = Object.keys(byLayer).map(Number).sort((a, b) => a - b)
      const colW = w / (layers.length + 1)
      layers.forEach((d, i) => {
        const col = byLayer[d].sort((a, b) => a.label.localeCompare(b.label))
        const rowH = h / (col.length + 1)
        col.forEach((n, j) => targets.set(n.id, { x: colW * (i + 1), y: rowH * (j + 1) }))
      })
    } else { // cluster by category
      const byCat = {}
      nodes.forEach((n) => { (byCat[n.category] ||= []).push(n) })
      const cats = Object.keys(byCat).sort()
      const cols = Math.ceil(Math.sqrt(cats.length))
      const rows = Math.ceil(cats.length / cols)
      const cellW = w / cols, cellH = h / rows
      cats.forEach((cat, ci) => {
        const cx = cellW * (ci % cols) + cellW / 2
        const cy = cellH * Math.floor(ci / cols) + cellH / 2
        const list = byCat[cat]
        const rad = Math.min(cellW, cellH) * 0.33
        list.forEach((n, i) => {
          const ang = (i / list.length) * Math.PI * 2
          const rr = list.length === 1 ? 0 : rad * (0.4 + 0.6 * ((i % 3) / 2))
          targets.set(n.id, { x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr })
        })
      })
    }
  }

  function seedPositions() {
    const cx = W() / 2, cy = H() / 2
    nodes.forEach((n) => {
      const a = rng() * Math.PI * 2
      const rad = 60 + rng() * Math.min(W(), H()) * 0.34
      n.x = cx + Math.cos(a) * rad
      n.y = cy + Math.sin(a) * rad
      n.vx = n.vy = 0
      n.pinned = false
    })
    // Root in the middle for a tidier force layout.
    const root = nodeById.get('snappet')
    if (root) { root.x = cx; root.y = cy }
  }

  // ── Simulation ──────────────────────────────────────────────────────────
  let alpha = 1
  function tick() {
    if (targets) {
      // Ease toward layout targets + gentle de-overlap.
      nodes.forEach((n) => {
        if (n.pinned) return
        const t = targets.get(n.id)
        n.x += (t.x - n.x) * 0.12
        n.y += (t.y - n.y) * 0.12
      })
      deOverlap(0.5)
    } else {
      // Force-directed: repulsion + spring + centering gravity.
      const cx = W() / 2, cy = H() / 2
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          let dx = a.x - b.x, dy = a.y - b.y
          let d2 = dx * dx + dy * dy || 0.01
          const f = (3200 * alpha) / d2
          const d = Math.sqrt(d2)
          const fx = (dx / d) * f, fy = (dy / d) * f
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
        }
      }
      edges.forEach((e) => {
        const a = e.source, b = e.target
        let dx = b.x - a.x, dy = b.y - a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const ideal = 95
        const f = (d - ideal) * 0.018 * alpha
        const fx = (dx / d) * f, fy = (dy / d) * f
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
      })
      nodes.forEach((n) => {
        n.vx += (cx - n.x) * 0.0016 * alpha
        n.vy += (cy - n.y) * 0.0016 * alpha
        if (n.pinned) { n.vx = n.vy = 0; return }
        n.vx *= 0.86; n.vy *= 0.86
        n.x += n.vx; n.y += n.vy
      })
      if (alpha > 0.02) alpha *= 0.99
    }
    draw()
    raf = requestAnimationFrame(tick)
  }

  function deOverlap(strength) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        const dx = a.x - b.x, dy = a.y - b.y
        const min = a.r + b.r + 14
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        if (d < min) {
          const push = ((min - d) / d) * strength
          const px = dx * push, py = dy * push
          if (!a.pinned) { a.x += px; a.y += py }
          if (!b.pinned) { b.x -= px; b.y -= py }
        }
      }
    }
  }

  // ── Draw (apply positions + highlight state) ─────────────────────────────
  function draw() {
    gZoom.setAttribute('transform', `translate(${transform.x},${transform.y}) scale(${transform.k})`)

    const focus = highlightSet()
    nodeEls.forEach(({ n, g, c }) => {
      const vis = isVisible(n)
      g.style.display = vis ? '' : 'none'
      g.setAttribute('transform', `translate(${n.x},${n.y})`)
      g.classList.toggle('dim', focus && !focus.nodes.has(n.id))
      g.classList.toggle('hi', focus && focus.nodes.has(n.id) && n.id !== selectedId)
      g.classList.toggle('sel', n.id === selectedId)
      c.setAttribute('r', n.id === selectedId ? n.r + 2 : n.r)
    })

    edgeEls.forEach(({ e, p, lbl }) => {
      const vis = isVisible(e.source) && isVisible(e.target)
      p.style.display = vis ? '' : 'none'
      const a = e.source, b = e.target
      p.setAttribute('d', `M${a.x},${a.y} L${b.x},${b.y}`)
      if (focus) {
        const on = focus.edges.has(e)
        p.classList.toggle('hi', on)
        p.classList.toggle('dim', !on)
      } else {
        p.classList.remove('hi', 'dim')
      }
      if (lbl) {
        const show = vis && (transform.k > 0.85 || (focus && focus.edges.has(e)))
        lbl.style.display = show ? '' : 'none'
        lbl.setAttribute('x', (a.x + b.x) / 2)
        lbl.setAttribute('y', (a.y + b.y) / 2 - 3)
      }
    })
  }

  function isVisible(n) {
    return !hidden.type.has(n.type) && !hidden.category.has(n.category) && !hidden.layer.has(n.layer)
  }

  // What to highlight: selected node + neighbors, or an active path.
  let activePath = null
  function highlightSet() {
    if (activePath) return activePath
    if (!selectedId) return null
    const ns = new Set([selectedId])
    const es = new Set()
    for (const { id, edge } of adj.get(selectedId)) { ns.add(id); es.add(edge) }
    return { nodes: ns, edges: es }
  }

  // ── Path tracing (BFS shortest path) ─────────────────────────────────────
  function shortestPath(aId, bId) {
    const prev = new Map([[aId, null]])
    const q = [aId]
    while (q.length) {
      const id = q.shift()
      if (id === bId) break
      for (const { id: nb } of adj.get(id)) {
        if (!prev.has(nb) && isVisible(nodeById.get(nb))) { prev.set(nb, id); q.push(nb) }
      }
    }
    if (!prev.has(bId)) return null
    const ids = []
    for (let cur = bId; cur != null; cur = prev.get(cur)) ids.unshift(cur)
    const ns = new Set(ids), es = new Set()
    for (let i = 0; i < ids.length - 1; i++) {
      const e = edges.find(
        (e) => (e.s === ids[i] && e.t === ids[i + 1]) || (e.t === ids[i] && e.s === ids[i + 1]),
      )
      if (e) es.add(e)
    }
    return { nodes: ns, edges: es, length: ids.length - 1 }
  }

  // ── Interaction: zoom, pan, node drag ────────────────────────────────────
  let raf = null
  function screenToGraph(sx, sy) {
    const rect = svg.getBoundingClientRect()
    return { x: (sx - rect.left - transform.x) / transform.k, y: (sy - rect.top - transform.y) / transform.k }
  }

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const rect = svg.getBoundingClientRect()
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12
    const k = Math.max(0.25, Math.min(3.5, transform.k * factor))
    transform.x = mx - ((mx - transform.x) / transform.k) * k
    transform.y = my - ((my - transform.y) / transform.k) * k
    transform.k = k
    draw()
  }, { passive: false })

  let panning = null
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.node')) return
    panning = { x: ev.clientX - transform.x, y: ev.clientY - transform.y }
    svg.classList.add('panning')
    svg.setPointerCapture(ev.pointerId)
  })
  svg.addEventListener('pointermove', (ev) => {
    if (drag) {
      const p = screenToGraph(ev.clientX, ev.clientY)
      drag.n.x = p.x; drag.n.y = p.y; drag.n.pinned = true
      if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 4) drag.moved = true
      draw()
    } else if (panning) {
      transform.x = ev.clientX - panning.x
      transform.y = ev.clientY - panning.y
      draw()
    }
  })
  window.addEventListener('pointerup', (ev) => {
    panning = null
    svg.classList.remove('panning')
    if (drag) {
      if (!drag.moved) onNodeClick(drag.n)
      drag = null
    }
  })

  let drag = null
  function onNodePointerDown(ev, n) {
    ev.stopPropagation()
    drag = { n, sx: ev.clientX, sy: ev.clientY, moved: false }
  }

  function onNodeClick(n) {
    if (pathMode) {
      if (!pathFrom) {
        pathFrom = n.id
        toast(`Path from "${n.label}" — now click a destination`)
      } else {
        const res = shortestPath(pathFrom, n.id)
        if (res) {
          activePath = res
          selectedId = null
          closeDetail()
          toast(`Path: ${res.length} hop${res.length === 1 ? '' : 's'} (Esc to clear)`)
        } else {
          toast('No path between those nodes')
        }
        pathMode = false; pathFrom = null
        $('pathBtn').classList.remove('active')
      }
      draw()
      return
    }
    activePath = null
    selectedId = n.id
    openDetail(n)
    setHash(n.id)
    draw()
  }

  // ── Detail panel ─────────────────────────────────────────────────────────
  function openDetail(n) {
    const meta = TYPE_META[n.type] || {}
    $('detailType').textContent = meta.label || n.type
    $('detailType').style.background = meta.color || '#888'
    $('detailTitle').textContent = n.label
    $('detailFile').textContent = n.file || ''
    $('detailDesc').textContent = n.desc || ''
    const tags = $('detailTags')
    tags.innerHTML = ''
    ;(n.tags || []).forEach((t) => {
      const s = document.createElement('span'); s.className = 'tag'; s.textContent = t; tags.appendChild(s)
    })

    // Outgoing / incoming relationships.
    const out = edges.filter((e) => e.s === n.id)
    const inc = edges.filter((e) => e.t === n.id)
    const rels = $('detailRels')
    rels.innerHTML = ''
    relGroup(rels, '→ Connects to', out.map((e) => ({ e, other: nodeById.get(e.t), verb: e.type })))
    relGroup(rels, '← Referenced by', inc.map((e) => ({ e, other: nodeById.get(e.s), verb: e.type })))

    $('detail').classList.add('open')
  }
  function relGroup(parent, title, items) {
    if (!items.length) return
    const g = document.createElement('div'); g.className = 'rel-group'
    const h = document.createElement('h4'); h.textContent = `${title} (${items.length})`; g.appendChild(h)
    items.forEach(({ other, verb }) => {
      const row = document.createElement('div'); row.className = 'rel'
      const sw = document.createElement('span'); sw.className = 'swatch'
      sw.style.background = (TYPE_META[other.type] || {}).color || '#888'
      const name = document.createElement('span'); name.textContent = other.label
      const v = document.createElement('span'); v.className = 'verb'; v.textContent = verb
      row.append(sw, name, v)
      row.addEventListener('click', () => { onNodeClick(other); focusNode(other) })
      g.appendChild(row)
    })
    parent.appendChild(g)
  }
  function closeDetail() { $('detail').classList.remove('open') }

  function focusNode(n) {
    // Center the viewport on a node smoothly.
    const k = Math.max(transform.k, 1)
    transform.k = k
    transform.x = W() / 2 - n.x * k
    transform.y = H() / 2 - n.y * k
    draw()
  }

  // ── Sidebar: legend + filters ─────────────────────────────────────────────
  function buildSidebar() {
    const counts = (key) => {
      const m = {}
      nodes.forEach((n) => { m[n[key]] = (m[n[key]] || 0) + 1 })
      return m
    }
    // Legend (also acts as a type filter).
    const typeCounts = counts('type')
    const legend = $('legend')
    Object.keys(TYPE_META).forEach((type) => {
      if (!typeCounts[type]) return
      const row = document.createElement('div'); row.className = 'legend-item filter-item'
      row.innerHTML = `<span class="swatch" style="background:${TYPE_META[type].color}"></span>` +
        `<span>${TYPE_META[type].label}</span><span class="legend-count">${typeCounts[type]}</span>`
      row.addEventListener('click', () => toggleFilter('type', type, row))
      legend.appendChild(row)
    })
    buildFilterList('catFilters', 'category')
    buildFilterList('layerFilters', 'layer')
  }
  function buildFilterList(elId, key) {
    const m = {}
    nodes.forEach((n) => { m[n[key]] = (m[n[key]] || 0) + 1 })
    const box = $(elId)
    Object.keys(m).sort().forEach((val) => {
      const row = document.createElement('div'); row.className = 'filter-item'
      row.innerHTML = `<span>${val}</span><span class="legend-count">${m[val]}</span>`
      row.addEventListener('click', () => toggleFilter(key, val, row))
      box.appendChild(row)
    })
  }
  function toggleFilter(key, val, row) {
    if (hidden[key].has(val)) { hidden[key].delete(val); row.classList.remove('off') }
    else { hidden[key].add(val); row.classList.add('off') }
    draw()
  }

  // ── Search ────────────────────────────────────────────────────────────────
  function runSearch(q) {
    q = q.trim().toLowerCase()
    if (!q) { activePath = null; selectedId = null; closeDetail(); draw(); return }
    const score = (n) => {
      const hay = [n.label, n.type, n.category, n.file, ...(n.tags || [])].join(' ').toLowerCase()
      if (n.label.toLowerCase().startsWith(q)) return 3
      if (n.label.toLowerCase().includes(q)) return 2
      if (hay.includes(q)) return 1
      return 0
    }
    const hits = nodes.map((n) => ({ n, s: score(n) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
    if (!hits.length) return
    const ns = new Set(hits.map((h) => h.n.id))
    activePath = { nodes: ns, edges: new Set() }
    if (hits.length === 1) { onNodeClick(hits[0].n); focusNode(hits[0].n) }
    draw()
  }

  // ── Deep-linking ───────────────────────────────────────────────────────────
  function setHash(id) {
    const u = new URL(location.href); u.searchParams.set('node', id)
    history.replaceState(null, '', u)
  }
  function readHash() {
    const id = new URL(location.href).searchParams.get('node')
    if (id && nodeById.has(id)) {
      const n = nodeById.get(id)
      selectedId = id; openDetail(n)
      setTimeout(() => focusNode(n), 400)
    }
  }

  // ── PNG export (self-contained, inlines minimal styles) ───────────────────
  function exportPng() {
    const cs = getComputedStyle(document.documentElement)
    const bg = cs.getPropertyValue('--bg').trim() || '#0b1020'
    const clone = svg.cloneNode(true)
    const pad = 40
    // Compute the bounding box of all visible nodes in graph space.
    const vis = nodes.filter(isVisible)
    const xs = vis.map((n) => n.x), ys = vis.map((n) => n.y)
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad
    const maxX = Math.max(...xs) + pad, maxY = Math.max(...ys) + pad
    const w = maxX - minX, h = maxY - minY
    clone.setAttribute('width', w)
    clone.setAttribute('height', h)
    clone.querySelector('g').setAttribute('transform', `translate(${-minX},${-minY}) scale(1)`)
    const style = document.createElementNS(SVG_NS, 'style')
    style.textContent = EXPORT_CSS.replace(/__BG__/g, bg)
      .replace(/__TEXT__/g, cs.getPropertyValue('--text').trim())
      .replace(/__MUTED__/g, cs.getPropertyValue('--muted').trim())
      .replace(/__EDGE__/g, cs.getPropertyValue('--edge').trim())
    clone.insertBefore(style, clone.firstChild)
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('width', w); rect.setAttribute('height', h); rect.setAttribute('fill', bg)
    clone.insertBefore(rect, style.nextSibling)

    const data = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = w * scale; canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((png) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(png)
        a.download = 'snappet-knowledge-graph.png'
        a.click()
        toast('Exported PNG')
      })
    }
    img.onerror = () => toast('Export failed')
    img.src = url
  }
  const EXPORT_CSS = `
    .edge{stroke:__EDGE__;stroke-width:1.1;fill:none;opacity:.55}
    .edge.persist{stroke-dasharray:4 3}.edge.deploy{stroke-dasharray:1 4}
    .node circle{stroke:__BG__;stroke-width:2}
    .node text{fill:__TEXT__;font:600 10.5px sans-serif;paint-order:stroke;stroke:__BG__;stroke-width:3px;stroke-linejoin:round}
    .edge-label{fill:__MUTED__;font:8.5px sans-serif}`

  // ── Theme ───────────────────────────────────────────────────────────────
  function toggleTheme() {
    const root = document.documentElement
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', next)
    $('themeBtn').textContent = next === 'dark' ? '☀︎' : '☾'
    draw()
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  let toastTimer = null
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show')
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400)
  }

  // ── Wire up controls ──────────────────────────────────────────────────────
  $('layoutSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return
    setLayout(b.dataset.layout)
  })
  function setLayout(name) {
    layout = name
    document.querySelectorAll('#layoutSeg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.layout === name))
    if (name === 'force') { alpha = 1; seedPositions() }
    computeTargets()
  }

  $('search').addEventListener('input', (e) => runSearch(e.target.value))
  $('pathBtn').addEventListener('click', startPath)
  $('detailPathBtn').addEventListener('click', () => { pathFrom = selectedId; pathMode = true; $('pathBtn').classList.add('active'); toast('Now click a destination node') })
  function startPath() {
    pathMode = !pathMode; pathFrom = null
    $('pathBtn').classList.toggle('active', pathMode)
    toast(pathMode ? 'Click a start node, then a destination' : 'Path mode off')
  }
  $('exportBtn').addEventListener('click', exportPng)
  $('themeBtn').addEventListener('click', toggleTheme)
  $('helpBtn').addEventListener('click', () => $('helpModal').classList.add('open'))
  $('helpClose').addEventListener('click', () => $('helpModal').classList.remove('open'))
  $('helpModal').addEventListener('click', (e) => { if (e.target.id === 'helpModal') e.currentTarget.classList.remove('open') })
  $('detailClose').addEventListener('click', () => { closeDetail(); selectedId = null; draw() })
  $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'))

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return }
    if (e.key === '/') { e.preventDefault(); $('search').focus() }
    else if (e.key === '1') setLayout('force')
    else if (e.key === '2') setLayout('hierarchy')
    else if (e.key === '3') setLayout('cluster')
    else if (e.key.toLowerCase() === 't') toggleTheme()
    else if (e.key.toLowerCase() === 'p') startPath()
    else if (e.key === '?') $('helpModal').classList.add('open')
    else if (e.key === 'Escape') {
      activePath = null; selectedId = null; pathMode = false; pathFrom = null
      $('pathBtn').classList.remove('active'); closeDetail()
      $('helpModal').classList.remove('open'); $('search').value = ''
      draw()
    }
  })

  window.addEventListener('resize', () => { computeTargets(); draw() })

  // ── Boot ──────────────────────────────────────────────────────────────────
  buildSidebar()
  seedPositions()
  computeTargets()
  readHash()
  raf = requestAnimationFrame(tick)
  // First-visit help.
  if (!localStorage.getItem('snappet:kg:seen')) {
    $('helpModal').classList.add('open')
    localStorage.setItem('snappet:kg:seen', '1')
  }
})()
