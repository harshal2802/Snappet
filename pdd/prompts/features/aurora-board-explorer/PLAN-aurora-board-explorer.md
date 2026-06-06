# PLAN: Board Explorer (Aurora / boardlib data)

**Status**: drafting (rev. 2 — snappet-mobile import compatibility verified)
**Owner**: pdd
**Route**: `/board-explorer`  ·  **Category**: Utilities  ·  **Icon**: 🧗
**Research**: [`pdd/context/research/aurora-board-explorer.md`](../../context/research/aurora-board-explorer.md)
**New dep**: `sql.js` (WASM SQLite)  ·  **New build script**: `scripts/build-board-snapshots.py`
**Cross-repo contract**: exported `.db` must satisfy `snappet-mobile`'s `KilterCatalogValidator`
(issue #42) and read cleanly in `KilterCatalog`.

## Goal

A Snappet mini-app to **browse, filter, and download** the public climb catalogue of **all Aurora
boards** (Kilter, Tension, Decoy, Grasshopper, Soill, Touchstone, Aurora) — the data `boardlib`
produces — entirely client-side. Pick a board, filter, view a sortable table, and export the filtered
set as **CSV**, **JSON**, or a **SQLite `.db`**. The Kilter `.db` export is **directly importable into
the Snappet mobile app** via its existing "Import catalog file…" flow.

## Non-goals
- No live login/sync to Aurora at runtime (CORS + forbidden auth surface).
- No per-user logbook/ascent data (needs a personal login).

## ⭐ Hard requirement: the `.db` export must import into snappet-mobile

The export is **not** a bespoke format — it is the **same schema** `tools/kilter/build_bundled_db.py`
produces in the `snappet-mobile` repo. Concretely the exported file MUST:

- Contain these tables (validator): `difficulty_grades, layouts, climbs, climb_stats, placements,
  holes, placement_roles, leds` — **and** for a *usable* import also `climb_cache_fields, beta_links,
  holds, products, product_sizes, sets, product_sizes_layouts_sets, products_angles`.
- Use each table's **original Aurora `CREATE TABLE` DDL** (copied from the snapshot via
  `sqlite_master`), not a re-invented schema.
- Copy the reference/geometry tables **whole**; insert only the **filtered** rows into
  `climbs, climb_stats, climb_cache_fields, beta_links`.
- Have **≥1** `climbs WHERE is_listed = 1`; be **≤ 512 MB**.
- For "mobile-compatible" exports, restrict climbs to `frames_count = 1` and (for the import target)
  `layout_id IN (1, 8)` — Kilter Original + Homewall.

Boards other than Kilter export a **valid Aurora `.db`** but mobile has no reader for their layouts
yet → the UI labels Kilter as "✓ importable into Snappet mobile" and others as "valid `.db`,
mobile import coming later".

## Architecture

```
public/board-data/manifest.json     ← eager; {board, climbs, layouts, generatedAt, importableToMobile}
public/board-data/<board>.sqlite.gz  ← lazy on board select; SCHEMA-FAITHFUL Aurora db; NOT precached
public/sql-wasm.wasm                  ← sql.js engine; lazy; NOT precached

apps/board-explorer/
  index.tsx        ← shell: board picker, filter panel, results, export bar, tour, reset
  db.ts            ← sql.js loader (locateFile→BASE_URL), gzip decompress, open board db (memoized)
  query.ts         ← parameterized SELECT mirroring KilterCatalog's listing query
  exportDb.ts      ← browser port of build_bundled_db.py: copy ref tables whole + insert filtered climbs → db.export()
  exportFlat.ts    ← toCsv / toJson over the filtered result set
  validate.ts      ← replicate KilterCatalogValidator checks; gate the .db download, surface errors
  filters.tsx · ResultsTable.tsx · presets.ts · types.ts · tour.ts
```

## Phased prompt chain

| Phase | Prompt file | Scope |
|---|---|---|
| 0 | `43-board-explorer-00-snapshot-pipeline.md`   | snapshot build script (reuse mobile's `build_bundled_db.py`) + sizing gate |
| 1 | `43-board-explorer-01-scaffold-and-load.md`   | dep, catalog/route, sql.js loader, board picker, "data as of" |
| 2 | `43-board-explorer-02-filters-and-table.md`   | FilterState, parameterized query, sortable results table |
| 3 | `43-board-explorer-03-export-and-import-parity.md` | CSV + JSON + schema-faithful `.db`; in-app validator; **mobile import verification** |
| 4 | `43-board-explorer-04-polish-seo-tour.md`     | presets, states, SEO, tour, README + knowledge-graph, decisions entry |

### Phase 0 — Snapshot pipeline + sizing gate (FIRST)
- `scripts/build-board-snapshots.py`: wrap `boardlib database <board>`; **reuse / import**
  `snappet-mobile`'s `tools/kilter/build_bundled_db.py` logic (same `FULL_TABLES` whole +
  `CLIMB_TABLES` subset) so web and mobile share one trimming definition. Web snapshot keeps a high
  (or no) climb cap — the user filters in-browser. `VACUUM`, gzip → `public/board-data/`, emit manifest.
- **Measure** gzipped + uncompressed size per board against the **512 MB** import cap and the bundle
  budget → **decision gate**: in-repo vs git-LFS vs GitHub Release asset (research OQ#1).
- Produce one real snapshot (or the synthetic Kilter fixture from mobile) for Phases 1–3.

### Phase 1 — Scaffold + load a board
- `npm i sql.js`; place `sql-wasm.wasm` in `public/`; `initSqlJs({ locateFile })`.
- Add `/board-explorer` to `seo/catalog.ts` + `router/routes.tsx`; create `apps/board-explorer/`.
- Board picker from `manifest.json`; lazy fetch `<board>.sqlite.gz` → `DecompressionStream('gzip')`
  → `new SQL.Database(bytes)`; memoize. Header: "<board> · N climbs · data as of <date>" + attribution.

### Phase 2 — Filters + results table
- `FilterState`: `{ layoutId?, angle?, gradeMin?, gradeMax?, minAscents?, minQuality?, setter?,
  name?, benchmarkOnly?, listedOnly?, singleFrameOnly?, sort }`.
- `query.ts`: **parameterized** SELECT mirroring `KilterCatalog`'s listing
  (`climbs c JOIN climb_stats cs ON cs.climb_uuid=c.uuid AND cs.angle=? WHERE c.is_listed=1 AND
  c.layout_id=? AND cs.display_difficulty BETWEEN ? AND ? AND cs.ascensionist_count>=? AND
  cs.quality_average>=?` + optional name/setter LIKE + benchmark) so the table preview matches what
  the phone will show. Grade range via `difficulty_grades`. Cap rendered rows; show total count.
- `ResultsTable.tsx`: sortable, windowed for 100k-row boards; row → details (grade-by-angle, holds).

### Phase 3 — Export + import parity (the headline)
- `exportFlat.ts`: **CSV** (boardlib-logbook-flavored columns) + **JSON** of the filtered set.
- `exportDb.ts`: open a fresh `SQL.Database`; for every required table read its DDL from the snapshot
  (`SELECT sql FROM sqlite_master WHERE name=?`) and recreate it; copy reference/geometry tables whole;
  insert filtered `climbs` (+ `climb_stats`, `climb_cache_fields`, `beta_links` for those uuids);
  `VACUUM`; `db.export()` → `Blob('application/x-sqlite3')` → `kilter-filtered-<date>.sqlite3`.
- `validate.ts`: replicate `KilterCatalogValidator` (required tables, `COUNT(*) climbs is_listed=1 ≥1`,
  ≤512 MB) and **block the download with a clear message if it would fail**. Show "✓ importable into
  Snappet mobile" for Kilter.
- **Verification** (must do before marking done): build a real Kilter export and confirm it passes —
  either by running the actual `KilterCatalogValidator` logic against it, or importing it into the
  `snappet-mobile` app's "Import catalog file…" and seeing climbs render. Record the result.

### Phase 4 — Polish, SEO/AEO, tour, docs
- Presets; loading/empty/error/no-WASM states.
- `seo/catalog.ts` entry (tagline, features, faqs incl. "Can I use this on the Snappet phone app?" →
  yes, export Kilter `.db` → Import catalog file; "Is my data uploaded?" → no, fully in-browser).
- `GuidedTour` (`appId="board-explorer"`); README tools table; knowledge-graph `data.js` (node +
  deps sql.js, board-data, boardlib, **edge to snappet-mobile import contract**).
- `decisions.md` entry (bundled snapshot + sql.js + **export schema pinned to mobile's validator**).
- Consider a line in `pdd/context/snappet-core-schema.md` recording the export-schema contract.

## Risks / watch-items
- **Schema drift web↔mobile** — top risk now. Pin to mobile's `build_bundled_db.py`/validator; the
  Phase-3 verification is the guard.
- **Bundle size** vs the 512 MB cap and PWA budget → Phase 0 gate.
- **Geometry completeness** — exports must keep `holes/placements/leds/...` or the phone renders no
  board; copying reference tables whole (never subsetting them) prevents this.
- **PWA precache** — exclude `board-data/**` + `sql-wasm.wasm` in `vite.config.ts`.

## Definition of done (v1)
Pick any Aurora board → filter → sortable results with live count → export filtered set to CSV, JSON,
and a **schema-faithful `.db`** → for Kilter, that `.db` **passes `KilterCatalogValidator` and imports
into snappet-mobile, rendering climbs** — all client-side, offline after first load, attributed, toured.
