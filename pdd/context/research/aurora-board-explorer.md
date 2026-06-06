# Research: Aurora Board Explorer (boardlib data) for Snappet

**Date**: 2026-06-06 (rev. 2 — adds snappet-mobile import compatibility)
**Outcome**: **Build** a new mini-app — **Board Explorer** — that loads **bundled, schema-faithful
SQLite snapshots** of every Aurora Climbing board's public climb database (produced offline with
[`boardlib`](https://github.com/lemeryfertitta/BoardLib)), queries them **100% in-browser** with
`sql.js` (WASM SQLite), exposes a **full filter set**, and **exports the filtered subset** to
**CSV**, **JSON**, and a downloadable **SQLite `.db`**. The `.db` export is **byte-compatible with
the `snappet-mobile` "Import catalog file…" flow** (issue #42) — the same schema its
`build_bundled_db.py` produces and its `KilterCatalogValidator` accepts. No backend, no credentials,
no live API calls at runtime.

---

## Problem

Climbers using Kilter / Tension / etc. boards want to **browse and filter the shared climb
catalogue** (angle, difficulty, popularity, quality, setter…) inside Snappet and **take a filtered
slice away** as a file. A primary use of that file: **import it into the `snappet-mobile` app** so
the phone has an offline catalog (mobile ships zero Aurora data on purpose).

## What boardlib does (and why a browser can't replicate the download)

`boardlib` is a **Python CLI**. `boardlib database <board> <out.db> --username <u>`:
1. **Logs in** — `PUT https://api.{host}.com/sessions` `{username,password,tou,pp,ua}` → `session` token.
   `HOST_BASES = {aurora: auroraboardapp, decoy: decoyboardapp, grasshopper: grasshopperboardapp,
   kilter: kilterboardapp, soill: soillboardapp, tension: tensionboardapp2, touchstone:
   touchstoneboardapp}` → host `api.{value}.com`.
2. **Seeds** a base SQLite db (extracted from the board's Android **APK**).
3. **Syncs** shared + user tables — `POST /sync` with `Cookie: token={token}`.

**Why not in-browser:** the Aurora hosts send **no CORS headers** (mobile-app endpoints), so a page
`fetch()` is blocked; and replicating login means collecting board credentials in a static page —
the "auth surface" the project forbids (`decisions.md` → *"No backend, fully client-side"*).
**User decision (2026-06-06):** bundle full snapshots of **all** Aurora boards, ship the **full
explorer**, and add a **filtered-`.db` export**.

## Aurora SQLite schema (the tables that matter)

| Table | Role |
|---|---|
| `climbs` | `uuid, layout_id, setter_username, name, description, frames, frames_count, is_listed, is_draft, edge_left/right/bottom/top, created_at` |
| `climb_stats` | `climb_uuid, angle, display_difficulty, benchmark_difficulty, ascensionist_count, quality_average, fa_username` |
| `climb_cache_fields` | `climb_uuid, display_difficulty, quality_average, ascensionist_count` (denormalized cache) |
| `beta_links` | `climb_uuid, link, is_listed` |
| `difficulty_grades` | `difficulty (int), boulder_name` (e.g. `"6C+/V5"`) |
| `layouts`, `products`, `product_sizes`, `sets`, `product_sizes_layouts_sets`, `products_angles` | board setup |
| `holes`, `holds`, `placements`, `placement_roles`, `leds` | **board geometry** (hold x/y, roles/colors, LED map) |

Display grade = `difficulty_grades.boulder_name` where `difficulty = ROUND(display_difficulty)`,
joined `climbs.uuid = climb_stats.climb_uuid`. A climb's holds are encoded in `frames` (tokens split
on `"p"`, each `"r"` → `(placement_id, role_id)`), resolved to x/y via `placements`→`holes`.

## ⭐ Cross-app compatibility: import into `snappet-mobile` (the binding constraint)

`snappet-mobile` already implements **"Import catalog file…"** (iOS Files / Android SAF) — issue #42.
The web export **must** satisfy its existing validator + reader, verbatim:

**`KilterCatalogValidator` (iOS `…/Features/Kilter/KilterCatalogValidator.swift`, mirrored on Android) requires:**
- **Tables present:** `difficulty_grades, layouts, climbs, climb_stats, placements, holes,
  placement_roles, leds`.
- **At least one listed climb:** `SELECT COUNT(*) FROM climbs WHERE is_listed = 1` ≥ 1.
- **Size cap:** ≤ **512 MB** (512 × 1,000,000 bytes).
- **Version** (informational): `c{climbs}·s{stats}·g{grades}·` + FNV-1a hex of
  `"{climbs}|{stats}|{grades}|{MAX(created_at)}"` (offset basis `0xcbf29ce484222325`, prime
  `0x100000001b3`). The web app doesn't need to reproduce this, only to produce a file that yields one.

**`KilterCatalog` reader also queries** (so these must be populated for a *usable* import):
`climb_cache_fields` (by-uuid panel), `beta_links` (where `is_listed=1`), `holds`,
`product_sizes_layouts_sets` + `leds` (LED map), `products_angles`.

**`tools/kilter/build_bundled_db.py`** (mobile's own builder) is the reference implementation:
- **Copies whole** (`FULL_TABLES`): `difficulty_grades, products, product_sizes, layouts, sets,
  product_sizes_layouts_sets, products_angles, placement_roles, holes, holds, placements, leds`.
- **Subsets by climb uuid** (`CLIMB_TABLES`): `climbs, climb_stats, climb_cache_fields, beta_links`.
- **Climb filter:** `is_listed = 1 AND layout_id IN (--layouts, default 1 8) AND frames_count = 1`,
  grouped by uuid, ordered by `MAX(climb_stats.ascensionist_count) DESC`, optional `--limit 800`.
  `VACUUM` at the end.

### Implications for this app (vs. rev. 1)

1. **No flattened `climb_browse` table.** Snapshots and exports must keep the **real Aurora schema**.
   The web `.db` export is a **browser-side reimplementation of `build_bundled_db.py`** where the
   user's filters define the climb subset (then it always copies the reference/geometry tables whole).
2. **`frames_count = 1` for importable exports.** The mobile frame decoder handles single-frame
   climbs; keep this filter on the export (and offer it as the default "mobile-compatible" mode).
3. **Kilter is the import target today.** Mobile only has `KilterCatalog`. Tension/Decoy/etc. exports
   are valid Aurora-shaped dbs but mobile has no reader for their layouts yet — so the explorer marks
   **Kilter (layouts 1 = Original, 8 = Homewall)** as "✓ importable into Snappet mobile", others as
   "valid Aurora `.db`, mobile import not yet supported".
4. **The export schema is now a cross-repo contract.** It is pinned to `snappet-mobile`'s
   `KilterCatalogValidator`. Document it; if mobile's validator changes, the web export must track it.
   (Candidate for a line in `pdd/context/snappet-core-schema.md`.)

## Approach decision: `sql.js`, schema-faithful, replicate `build_bundled_db.py`

`sql.js` (WASM SQLite, MIT, ~1 MB) loads the bundled board db, runs the filter `SELECT`, and for
export opens a **fresh** `new SQL.Database()`, recreates every required table with its **original
`CREATE TABLE` DDL** (read from the source via `sqlite_master`), copies the reference/geometry tables
whole, inserts the filtered `climbs/climb_stats/climb_cache_fields/beta_links`, `VACUUM`s, and
`db.export()` → `Blob` download. CSV/JSON fall out of the same filtered result set.

Rejected: bundling JSON + a hand-rolled SQLite writer (can't reproduce the exact schema/DDL the mobile
validator expects); flattening to one table (breaks geometry + the import contract).

New dep: **`sql.js`** `^1.x` (one WASM file).

## Snapshot pipeline (maintainer, offline — NOT runtime)

Reuse mobile's proven path. `scripts/build-board-snapshots.py`:
1. `boardlib database <board> <tmp>/<board>.db` (per board; Kilter login may be needed).
2. **Trim while preserving schema** — same `FULL_TABLES` copied whole + `CLIMB_TABLES` subset as
   `tools/kilter/build_bundled_db.py` (ideally import/share that script). Keep a generous climb cap
   (or none) for the *web* snapshot since the user filters further in-browser. `VACUUM`.
3. **gzip** → `src/frontend/public/board-data/<board>.sqlite.gz` + `public/board-data/manifest.json`
   (`{board, climbs, layouts, generatedAt, importableToMobile}`).

Runtime: `manifest.json` eager (tiny); `<board>.sqlite.gz` lazy on board select
(`fetch` → `DecompressionStream('gzip')` → `sql.js`). **Excluded** from the PWA precache, like the
workout `exercises.json` / tesseract assets. `sql-wasm.wasm` lives in `public/` (lazy, not precached).

## Filters (Aurora `explore` semantics)

Board · Layout + size · **Angle** · **Grade range** (via `difficulty_grades`) · **Min ascents** ·
**Min quality** · **Setter** · **Name** · **Benchmark only** · **Listed only** · **Single-frame only
(mobile-compatible)** · sort (popularity/quality/grade/name). Saved presets in `localStorage`.

## Open questions for the maintainer

1. **Repo size / hosting** — RESOLVED (2026-06-06): full all-climbs snapshots are committed **in-repo,
   served same-origin by Pages**. Largest is kilter at **81 MB gz** (344,504 climbs) — under GitHub's
   100 MB file limit. **GitHub Release assets were evaluated and rejected**: their cross-origin
   responses carry no `Access-Control-Allow-Origin`, so a browser `fetch()` from the Pages origin is
   CORS-blocked. **Git LFS** is the fallback only if a board ever exceeds 100 MB (deploy would need
   `lfs: true` so the build materializes real bytes into `dist`); the snapshot workflow prints sizes
   and hard-fails before any >99 MB push to signal the switch.
2. **Licensing/attribution** sign-off on shipping derived snapshots (mobile sidestepped this by
   shipping *zero* data and importing on-device — worth weighing the same stance for the web app, but
   the user explicitly chose bundling).
3. **Export schema contract** — record it in `snappet-core-schema.md` so web ↔ mobile can't drift.
