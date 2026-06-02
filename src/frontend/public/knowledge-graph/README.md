# Snappet Knowledge Graph

An interactive, **dependency-free** map of the Snappet codebase — every mini-app,
shared hook, build step, third-party dependency, and product-brain doc, wired by the
relationships that actually connect them.

**Live:** https://harshal2802.github.io/Snappet/knowledge-graph/

It is plain static HTML/CSS/JS. No framework, no build step, no backend — it works
offline straight from the filesystem. Because it lives under
`src/frontend/public/`, Vite copies it verbatim into `dist/` and it deploys with the
app to GitHub Pages.

## Files

| File | Role |
|---|---|
| `index.html` | UI shell — toolbar, sidebar (legend + filters), detail panel, help modal |
| `styles.css` | Theme (light/dark CSS variables) and layout |
| `data.js` | **The model** — nodes + edges. Single source of truth, dual-exported for the browser and the screenshot renderer |
| `graph.js` | The engine — force/hierarchy/cluster layouts, search, path tracing, filters, zoom/pan, deep-links, PNG export |

## Data model

### Nodes

```js
{ id, label, type, category, layer, file?, desc?, tags?[] }
```

`type` drives the color and the legend:

| Type | Meaning |
|---|---|
| `root` | The hub itself |
| `shell` | App shell / routing (`App`, `Layout`, route registry, PWA prompt) |
| `hub` | Hub landing UI (cards, usage dashboard) |
| `app` | A mini-app (Tip Calculator, Video Editor, …) |
| `hook` | Shared React hook (`useDarkMode`, `useLocalStorage`) |
| `lib` | Shared non-React library (`usage.ts`) |
| `seo` | SEO/AEO subsystem (catalog, meta, render, prerender) |
| `build` | Build / deploy / hosting (Vite, PWA, GitHub Actions, Pages) |
| `external` | A third-party dependency or data source |
| `pdd` | Product-brain doc (project, conventions, decisions, prompts, schema) |

### Edges

```js
{ s: sourceId, t: targetId, type, label? }
```

| Edge type | Means | Drawn as |
|---|---|---|
| `contains` | structural containment | solid |
| `route` | a router path renders this | solid |
| `uses` | runtime dependency | solid |
| `feeds` | produces data/signal for | solid |
| `prerender` | build-time HTML generation | solid |
| `persists` | writes to `localStorage` | dashed |
| `deploys` | a deploy/serve hop | dotted |
| `documents` | a PDD doc explains this | solid |

## Features

- **Three layouts** — Force (organic physics), Hierarchy (BFS layers from the root), Clusters (grouped by category). Toggle with the segmented control or keys `1` / `2` / `3`.
- **Fuzzy search** (`/`) across labels, types, files, and tags.
- **Click to focus** — selecting a node dims everything except it and its neighbors, and opens a detail panel listing what it connects to and what references it (each row is clickable).
- **Path tracing** — *Trace path*, then click two nodes to highlight the shortest route between them (e.g. how `Video Editor` reaches `GitHub Pages`).
- **Filters** — toggle any node type, category, or layer from the sidebar.
- **Zoom / pan / drag** — scroll to zoom, drag the background to pan, drag a node to pin it.
- **Deep-linking** — `?node=<id>` selects and centers a node on load (shareable).
- **PNG export** — download the current view at 2× for slides or docs.
- **Light / dark theme** (`T`).

## Updating the graph

Edit `data.js` only. Add a node to `NODES`, wire it with one or more `EDGES`, and the
legend, filters, layouts, and search pick it up automatically. Keep `id`s stable —
they are the deep-link anchors.

## Screenshots

The PNGs in [`docs/screenshots/`](../../../../docs/screenshots/) are rendered from this
exact `data.js` by `scripts/render-knowledge-graph.mjs`, so they never drift from the
real model.
