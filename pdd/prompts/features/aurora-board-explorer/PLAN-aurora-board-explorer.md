# PLAN: Board Explorer (Aurora / boardlib data)

**Status**: IMPLEMENTED + REAL DATA SHIPPED (branch `claude/funny-thompson-qTcoP`). All phases done.
Real snapshots for all 7 Aurora boards were generated on a GitHub-hosted runner
(`.github/workflows/board-snapshots.yml`, manual/one-shot) and committed to `public/board-data/`.
**The full catalogue is hosted — every climb, no reduction** (the trim copies the climb tables whole;
`--limit 0` default keeps all rows incl. unlisted): kilter **344,504** climbs (81 MB gz / 173 MB raw),
tension 128,762 (31 MB), grasshopper 21,504, decoy 8,046, aurora 6,709, soill 1,609, touchstone 1,528.
**Hosting gate resolved → in-repo, same-origin** (largest file 81 MB < the 100 MB GitHub file limit;
GitHub *Release assets* were rejected because their cross-origin responses carry no
`Access-Control-Allow-Origin`, so a browser fetch from the Pages origin would be CORS-blocked; Git LFS
is the documented fallback only if a board ever exceeds 100 MB — the workflow hard-fails with sizes to
flag that). Precache stays 66 entries / 3.3 MB — snapshots excluded. Licensing: owner approved
publishing publicly. Verified: the 173 MB / 344k-climb Kilter snapshot loads in sql.js and passes the
load→validate→query→mobile-compatible-export→subset integration test; real climbs render correctly
(e.g. "You Don't Know Me" 6a/V3, 77k ascents).
**Only remaining item**: the on-device "Import catalog file…" round-trip inside the snappet-mobile app
(needs its iOS/Android build — can't run in the web container; export is built + tested to its
`KilterCatalogValidator` contract).
**Owner**: pdd
**Route**: `/board-explorer`  ·  **Category**: `Utilities`  ·  **Icon**: 🧗
**Research**: [`pdd/context/research/aurora-board-explorer.md`](../../context/research/aurora-board-explorer.md)
**New deps**: `sql.js` (+ `@types/sql.js`, dev) · `vitest` (dev — none exists today)
**New script**: `scripts/build-board-snapshots.py`
**Cross-repo contract**: exported `.db` must satisfy `snappet-mobile`'s `KilterCatalogValidator`
(issue #42) and read cleanly in `KilterCatalog`.

## Goal

A client-side Snappet mini-app to **browse, filter, and download** the public climb catalogue of
**all Aurora boards** — the data `boardlib` produces. Pick a board, filter, view a sortable table, and
export the filtered set as **CSV**, **JSON**, or a **SQLite `.db`**. The Kilter `.db` export is
**directly importable into the Snappet mobile app** via its existing "Import catalog file…" flow.

## Non-goals
- No live login/sync to Aurora at runtime (CORS + forbidden auth surface).
- No per-user logbook/ascent data (needs a personal login).

## ⭐ Hard requirement: the `.db` export must import into snappet-mobile

The export is the **same schema** `snappet-mobile/tools/kilter/build_bundled_db.py` produces. It MUST:
- Contain (validator): `difficulty_grades, layouts, climbs, climb_stats, placements, holes,
  placement_roles, leds` — and for a usable render also `climb_cache_fields, beta_links, holds,
  products, product_sizes, sets, product_sizes_layouts_sets, products_angles`.
- Use each table's **original Aurora `CREATE TABLE` DDL** (read from the snapshot via `sqlite_master`),
  copy reference/geometry tables **whole**, insert only **filtered** rows into
  `climbs, climb_stats, climb_cache_fields, beta_links`.
- Have **≥1** `climbs WHERE is_listed=1`; be **≤ 512 MB**.
- "Mobile-compatible" mode restricts climbs to `is_listed=1 AND frames_count=1 AND layout_id IN (1,8)`.

Non-Kilter boards export a valid Aurora `.db` but mobile has no reader for their layouts yet → UI
labels Kilter "✓ importable into Snappet mobile", others "valid `.db`, mobile import coming later".

## Verified integration points (cite-accurate)

- **Catalog**: add one `AppMeta` object to `seo/catalog.ts` (icon `🧗`, category `Utilities`, with
  `tagline/features/faqs/keywords`; no `noindex`). The build-time prerenderer (`vite.config.ts:59-64`)
  iterates `catalog`, so a static SEO page is generated automatically.
- **Router**: add `'/board-explorer': () => import('../apps/board-explorer')` to the `loaders` map in
  `router/routes.tsx`. `App.tsx` lazy-mounts it inside the existing `<Suspense>`. No other routing work.
- **Shell**: replicate `apps/workout/index.tsx` header — `max-w-5xl mx-auto space-y-4` wrapper,
  `<h1>` + subtitle on the left, `<GuidedTour appId="board-explorer" steps={tourSteps}/>` + a plain
  `↺ Reset` button on the right (reuse the exact className). `Layout.tsx:32` already constrains width.
- **State**: `useLocalStorage<T>(key, init)` (signature `[T, Dispatch<SetStateAction<T>>]`) for
  `snappet:board-explorer:{filters,presets,board,mode}`. **Never** store query results or DB bytes in it.
- **Public assets**: reference via `` `${import.meta.env.BASE_URL}board-data/...` `` and
  `` `${import.meta.env.BASE_URL}sql-wasm.wasm` `` (pattern from `apps/workout/data.ts:13`), memoized
  with the module-level `cache`/`inflight` promise idiom.
- **PWA precache** (`vite.config.ts:146-154`): it's an **allowlist**
  (`globPatterns:['**/*.{js,css,html,svg,png,ico,woff,woff2}']`) — `.gz`/`.json`/`.wasm` are excluded
  automatically (same reason `exercises.json` is). **Do not** add those extensions to the glob. Add a
  defensive `globIgnores: ['**/board-data/**','**/sql-wasm.wasm']` as self-documenting insurance.

## Architecture — sql.js in a Web Worker (mirror the video-editor)

A ~69 MB Kilter DB + 100k-row scans + export rebuild **must not** block the main thread. Copy the
proven pattern: `apps/video-editor/media/proxy.ts` (main-thread Worker wrapper) +
`workers/proxy.worker.ts` (the worker), instantiated with
`new Worker(new URL('./workers/sql.worker.ts', import.meta.url), { type:'module' })` (Vite bundles it,
no config). Transfer large `Uint8Array`/`ArrayBuffer` payloads (`postMessage(msg,[buf])`), don't copy.

```
public/board-data/manifest.json     ← eager; [{board,label,climbs,layouts,generatedAt,importableToMobile,sizeBytesGz,sizeBytesRaw,url?}]
public/board-data/<board>.sqlite.gz  ← OR a GitHub Release asset URL (see hosting); lazy; precache-excluded
public/sql-wasm.wasm                  ← ~1MB; lazy; precache-excluded

apps/board-explorer/
  index.tsx        shell: board picker, filter panel, results, export bar, GuidedTour, ↺Reset; owns FilterState
  types.ts         FilterState, ManifestEntry, ClimbRow, ExportMode, ValidationResult, worker messages
  db.ts            main-thread Worker wrapper: openBoard/runQuery/count/buildExport, requestId correlation,
                   memoized manifest + sql-wasm URL (computed on MAIN thread, passed into worker)
  workers/sql.worker.ts   initSqlJs({locateFile:()=>passedUrl}); single live source DB; query/count/export; progress posts
  query.ts         PURE buildClimbWhere(filter)→{sql,params} + listing SELECT mirroring KilterCatalog; shared by browse + export
  exportDb.ts      DDL from sqlite_master (tables+indexes), copy ref tables whole, filtered insert via temp uuid table, VACUUM, export
  exportFlat.ts    PURE toCsv/toJson over the filtered rows
  validate.ts      PURE KilterCatalogValidator parity (required tables, is_listed≥1, ≤512MB); gates the .db download
  filters.tsx · ResultsTable.tsx · presets.ts · tour.ts
```

### Worker message protocol (each carries `requestId`)
- `open {board, gzBytes, wasmUrl}` → worker decompresses + `new SQL.Database(bytes)`; reply
  `opened {meta:{climbs,layouts,generatedAt}}`.
- `query {sql, params}` → `rows {columns, values}`; `count {sql,params}` → `count {n}` (same WHERE).
- `export {mode:'db', filter}` → `export-done {bytes (transferred), validation}`.
- `progress {phase, value}` during export (copy/insert/vacuum); `error {message}` on failure.
- CSV/JSON serialized on the **main thread** from the already-capped filtered rows.

### Export algorithm (`exportDb.ts`, in worker)
1. Read DDL for all required tables **and indexes** from `sqlite_master` (`type='table'` then
   `type='index' AND sql IS NOT NULL`); recreate parents before children.
2. Copy reference/geometry tables **whole** (batched `prepare`+`bind`/`step`/`reset` inside
   `BEGIN/COMMIT`; sql.js auto-commits per row otherwise — orders of magnitude slower).
3. Resolve filtered uuids; insert into a **temp `_tmp_uuids` table** in the source DB and subset the 4
   climb tables via `WHERE … IN (SELECT uuid FROM _tmp_uuids)` (avoids `SQLITE_MAX_VARIABLE_NUMBER` /
   statement-length limits); drop the temp table.
4. Recreate indexes; `VACUUM`; `out.export()` → transfer bytes; `validate()` **before** returning;
   `out.close()` and null the ref (peak memory = source + export + sql.js heap).
5. Main thread: `Blob([bytes],{type:'application/x-sqlite3'})` → object-URL anchor download
   `kilter-filtered-<date>.sqlite3` (helper mirrors `apps/workout/HistoryView.tsx:58-64`).

## Hosting decision (resolve in Phase 0 with real numbers)

**Recommendation: GitHub Release assets fetched at runtime** (URLs listed in the in-repo
`manifest.json`), *not* in-repo binaries, *not* git-LFS. Rationale: large `.sqlite.gz` (Kilter ~69 MB
raw, ~15-30 MB gz; ×7 boards) would permanently bloat git history; GH-Pages doesn't serve LFS
reliably; Release assets are CDN-backed, versioned, lazily fetched (matches the runtime model), and
trivially precache-excluded. **Phase-0 gate:** if total gz comfortably fits (< ~50 MB), in-repo
`public/board-data/` is acceptable for v1 simplicity + offline-first; otherwise go Release-asset.
`sql-wasm.wasm` (~1 MB) stays in `public/` either way. The **512 MB** cap binds the *export file*, not
the snapshot.

## Browser-support safeguards
Feature-detect `WebAssembly` and `DecompressionStream` (Chrome/Edge/FF113+/Safari16.4+); show an
unsupported-browser card (pattern: `apps/video-editor/support/{caps.ts,UnsupportedBrowser.tsx}`).
Debounce text filters before firing 100k-row scans. Results table **paginates** ("showing N of M") —
no virtual-list dep in the repo; pagination is dependency-free and sufficient.

## Snapshot pipeline — `scripts/build-board-snapshots.py` (maintainer, offline)
`build_bundled_db.py` is **not in this repo** (it's in snappet-mobile). **Vendor a copy** of its
`FULL_TABLES`(whole) + `CLIMB_TABLES`(subset) logic into the new script with a comment pinning the
source: *"keep in sync with snappet-mobile tools/kilter/build_bundled_db.py @ <sha>"*. The **web**
snapshot keeps a high/no climb cap and **omits** the `layout_id IN(1,8)`/`frames_count=1` restriction
(those are applied at *export* time per the user's mode, so the snapshot retains the superset). Steps:
`boardlib database <board> tmp.db` → trim (`is_listed=1`) → `VACUUM` → gzip → write
`public/board-data/<board>.sqlite.gz` + update `manifest.json` (incl. `sizeBytesRaw`).

## Testing — add vitest (none exists today)
Add `vitest` (dev) + `"test": "vitest run"`. Keep tests **pure + fixture-based** (run in Node; sql.js
runs in Node too):
- `query.test.ts` — `buildClimbWhere` produces expected SQL fragments + params per field; mobile mode
  adds `is_listed=1 AND frames_count=1 AND layout_id IN (1,8)`.
- `validate.test.ts` — **validator parity**: build a tiny synthetic sql.js DB (8 required tables, 1
  listed climb) → passes; drop a table / all `is_listed=0` / oversize → asserts the specific failure.
  This is the guard against web↔mobile schema drift.
- `exportFlat.test.ts` — CSV/JSON escaping, header, ordering.
- `exportDb.test.ts` — sql.js-in-Node over a 10-row synthetic source: output has required tables, ref
  tables copied whole, only filtered climbs, `VACUUM` ok, result passes `validate`.
Skip DOM/component tests (no testing-library; not the repo's convention).

## Phased prompt chain
| Phase | Prompt file | Scope |
|---|---|---|
| 0 | `43-board-explorer-00-snapshot-pipeline.md`        | vendored build script + real-size measurement + **hosting gate**; produce 1 real Kilter snapshot (or synthetic fixture) |
| 1 | `43-board-explorer-01-scaffold-and-load.md`        | `sql.js` dep + wasm in `public/`, vitest, catalog/route, worker + `db.ts`, board picker, "data as of", unsupported-browser card |
| 2 | `43-board-explorer-02-filters-and-table.md`        | `FilterState`, `query.ts` parameterized SELECT (+tests), paginated sortable `ResultsTable`, live count |
| 3 | `43-board-explorer-03-export-and-import-parity.md` | `exportFlat` (CSV/JSON), `exportDb`, `validate` (+tests), **mobile import verification** |
| 4 | `43-board-explorer-04-polish-seo-tour.md`          | presets, states, SEO catalog entry, tour, README + knowledge-graph node/edges, `decisions.md` |

### Spike first (riskiest unknowns)
1. **Cross-repo contract (highest).** `build_bundled_db.py` + `KilterCatalogValidator` live in
   snappet-mobile. Confirm exact DDL, the importer's accepted file extension(s), and the validator's
   table list against that repo / issue #42 **before** Phase 3; diff a known-good `build_bundled_db.py`
   output's `sqlite_master` against `exportDb.ts` output.
2. **Real snapshot size** vs PWA/import budget (Phase-0 gate).
3. **sql.js memory** with two DBs + `VACUUM` on mid-range mobile Safari — load 69 MB + full export in a
   worker, measure peak.
4. **`locateFile` in a Vite module worker** — pass the wasm URL from the main thread (avoid
   `import.meta.env` ambiguity in workers). Verify in Phase 1.

## Risks
- **Schema drift web↔mobile** (top) — pin to mobile's builder/validator; Phase-3 verification + the
  `validate.test.ts` parity fixture are the guards.
- **Bundle/repo size** → Phase 0 hosting gate.
- **Geometry completeness** — never subset reference tables, or the phone renders no board.
- **PWA precache** — keep `.gz/.json/.wasm` out of `globPatterns`; add defensive `globIgnores`.

## Definition of done (v1)
Pick any Aurora board → filter → sortable/paginated results with live count → export to CSV, JSON, and
a **schema-faithful `.db`** → for Kilter, that `.db` **passes `KilterCatalogValidator` and imports into
snappet-mobile, rendering climbs** — all client-side (sql.js in a worker), offline-capable after first
load, attributed, toured, with pure-logic + validator-parity tests green.
