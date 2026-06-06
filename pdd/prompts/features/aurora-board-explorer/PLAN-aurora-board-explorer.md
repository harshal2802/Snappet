# PLAN: Board Explorer (Aurora / boardlib data)

**Status**: drafting
**Owner**: pdd
**Route**: `/board-explorer`  ·  **Category**: Utilities (or Health)  ·  **Icon**: 🧗
**Research**: [`pdd/context/research/aurora-board-explorer.md`](../../context/research/aurora-board-explorer.md)
**New dep**: `sql.js` (WASM SQLite)  ·  **New build script**: `scripts/build-board-snapshots.py`

## Goal

A Snappet mini-app to **browse, filter, and download** the public climb catalogue of **all Aurora
Climbing boards** (Kilter, Tension, Decoy, Grasshopper, Soill, Touchstone, Aurora) — the data
`boardlib` produces — entirely client-side. Pick a board, apply rich filters, see a sortable results
table, and export the filtered set as **CSV**, **JSON**, or a downloadable **SQLite `.db`**.

## Non-goals (and why)

- **No live login/sync to Aurora at runtime** — CORS-blocked and a forbidden auth surface
  (research doc, "Why a pure client-side app cannot replicate the download"). Freshness comes from a
  maintainer-run snapshot refresh, not in-app.
- **No per-user logbook/ascent data** — that needs a personal login; out of scope for v1 (the
  bundled snapshots are the *shared* public catalogue only).

## Architecture at a glance

```
public/board-data/manifest.json          ← tiny, fetched eagerly (board list + counts + dates)
public/board-data/<board>.sqlite.gz       ← per board, lazy-fetched on selection, NOT precached
public/sql-wasm.wasm                       ← sql.js engine, lazy, NOT precached

apps/board-explorer/
  index.tsx          ← shell: board picker, filter panel, results, export bar, tour, reset
  db.ts              ← sql.js loader (locateFile→BASE_URL), gzip decompress, open board db (memoized)
  query.ts           ← build parameterized SELECT from FilterState; map rows→Climb
  export.ts          ← toCsv / toJson / toSqlite (new sql.js db of filtered subset → db.export())
  filters.tsx        ← FilterPanel (angle, grade range, min ascents, quality, setter, name, …)
  ResultsTable.tsx   ← virtualized sortable table (grade, name, angle, ascents, quality, setter)
  presets.ts         ← saved filters via useLocalStorage('snappet:board-explorer:presets')
  types.ts           ← Board, Climb, FilterState, Manifest
  tour.ts            ← guided-tour steps
```

State: `useState`/`useReducer` for `FilterState`; `useLocalStorage` for last board, last filters,
and saved presets; `↺ Reset` clears filters to defaults.

## Phased prompt chain

| Phase | Prompt file | Scope |
|---|---|---|
| 0 | `43-board-explorer-00-snapshot-pipeline.md` | `scripts/build-board-snapshots.py` + sizing spike |
| 1 | `43-board-explorer-01-scaffold-and-load.md`  | dep, catalog/route, sql.js loader, board picker, "data as of" |
| 2 | `43-board-explorer-02-filters-and-table.md`  | FilterState, parameterized query, results table, sort |
| 3 | `43-board-explorer-03-export.md`             | CSV + JSON + filtered `.db` export |
| 4 | `43-board-explorer-04-polish-seo-tour.md`    | presets, empty/loading/error states, SEO catalog entry, tour |

### Phase 0 — Snapshot pipeline + sizing spike (do FIRST; gates the rest)
- Write `scripts/build-board-snapshots.py`: wrap `boardlib database <board> …`, **slim** to a
  pre-joined `climb_browse` table (`uuid, name, setter_username, layout_id, angle, grade,
  grade_int, ascents, quality, benchmark, is_listed`) + the small lookup tables (`layouts`,
  `product_sizes`, `difficulty_grades`), drop PII/user/ascent tables, `VACUUM`, gzip to
  `public/board-data/<board>.sqlite.gz`, emit `manifest.json`.
- **Measure** the gzipped size per board (esp. Kilter). **Decision gate** → in-repo vs git-LFS vs
  GitHub Release asset (resolve research Open Question 1 with real numbers before Phase 1).
- Generate one real board's snapshot (or a synthetic fixture if no login available) so Phases 1–3
  have data to run against.

### Phase 1 — Scaffold + load a board
- `npm i sql.js`; copy `sql-wasm.wasm` into `public/` via a small copy step (mirror how public assets
  are handled); `db.ts` initializes `initSqlJs({ locateFile: () => BASE_URL + 'sql-wasm.wasm' })`.
- Add `/board-explorer` to `seo/catalog.ts` + `router/routes.tsx`; folder `apps/board-explorer/`.
- Board picker from `manifest.json`; on select → lazy `fetch(<board>.sqlite.gz)` →
  `DecompressionStream('gzip')` → `new SQL.Database(bytes)`; memoize per board.
- Header shows **"<board> · N climbs · data as of <date>"** + Aurora/boardlib attribution.

### Phase 2 — Filters + results table
- `FilterState`: `{ angle?, gradeMin?, gradeMax?, minAscents?, minQuality?, setter?, name?,
  benchmarkOnly?, listedOnly?, layoutId?, sort }`.
- `query.ts` builds a **parameterized** `SELECT … FROM climb_browse WHERE …` (no string-interpolated
  user input — bind params); grade range maps through `difficulty_grades`; sort by
  popularity/quality/grade/name. Cap rendered rows; show total match count.
- `ResultsTable.tsx`: sortable columns (grade, name, angle, ascents ★quality, setter); virtualized
  or windowed for 100k-row boards; row → expand for description/holds summary.

### Phase 3 — Export (the headline requirement)
- `export.ts`:
  - **CSV** — boardlib-logbook-flavored columns + browse fields; client-side blob download.
  - **JSON** — array of `Climb`.
  - **SQLite `.db`** — build a fresh `new SQL.Database()`, recreate `climb_browse` (+ referenced
    lookup rows for the matched climbs), bulk-insert the filtered set, `db.export()` →
    `Blob([bytes], {type:'application/x-sqlite3'})` → download `<board>-filtered-<date>.db`.
- Export reflects the **current filter** (filtered set), and offers "export all" too.

### Phase 4 — Polish, SEO/AEO, tour
- Saved-filter **presets** (`localStorage`); loading/empty/error/no-WASM-support states.
- `seo/catalog.ts`: `tagline`, `features`, `faqs` (incl. "Where does the data come from?" → boardlib
  snapshot + how to refresh; "Is my data uploaded?" → no, fully in-browser), `keywords`
  (kilter board, tension board, climbing board database, boardlib, climb finder).
- `GuidedTour` (`appId="board-explorer"`) over board picker → filters → results → export.
- Update README tools table + knowledge-graph `data.js` (node + deps: sql.js, board-data, boardlib).
- Add a `decisions.md` entry (bundled-snapshot + sql.js + no-runtime-API rationale).

## Risks / watch-items
- **Bundle size** is the top risk → Phase 0 gate decides hosting strategy.
- **Memory**: a 100k-row board in `sql.js` + a virtualized table is fine, but build the export db
  streamed in batches; avoid materializing two full copies needlessly.
- **PWA precache**: explicitly exclude `board-data/**` and `sql-wasm.wasm` (glob ignore in
  `vite.config.ts` PWA config), exactly like the large workout/tesseract assets.
- **Licensing/attribution** sign-off (research Open Question 2) before shipping snapshots publicly.

## Definition of done (v1)
Pick any Aurora board → filter by angle/grade/ascents/quality/setter/name → sortable results with
live match count → export the filtered set to CSV, JSON, **and a working `.db`** — all client-side,
offline after first load, with visible "data as of" + attribution and a guided tour.
