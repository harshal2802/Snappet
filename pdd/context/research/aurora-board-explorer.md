# Research: Aurora Board Explorer (boardlib data) for Snappet

**Date**: 2026-06-06
**Outcome**: **Build** a new mini-app — **Board Explorer** — that loads **bundled, pre-converted
SQLite snapshots** of every Aurora Climbing board's public climb database (produced offline with
[`boardlib`](https://github.com/lemeryfertitta/BoardLib)), queries them **100% in-browser** with
`sql.js` (WASM SQLite), exposes a **full filter set** (board, layout/size, angle, grade range, min
ascents, quality, setter, name, benchmark, listed), and **exports the filtered subset** to **CSV,
JSON, and a downloadable `.db` SQLite file**. No backend, no credentials, no live API calls at
runtime — the snapshots are refreshed by a maintainer-run script that wraps `boardlib`.

---

## Problem

The user wants, inside Snappet, "an interface to download Aurora climbing board data as described in
the boardlib library, with appropriate filters." Climbers using Kilter / Tension / etc. boards want
to **browse and filter the shared climb catalogue** (by angle, difficulty, popularity, quality,
setter…) and **take a filtered slice away** as a file they can keep or feed into other tools.

## What boardlib actually does (and why it can't run as-is in a browser)

`boardlib` is a **Python CLI**. Its `database` command:

1. **Logs in** to the board's mobile API — `PUT https://api.{host}.com/sessions` with a JSON body
   `{username, password, tou, pp, ua}`, returning `session` (a token).
   `HOST_BASES = {aurora: auroraboardapp, decoy: decoyboardapp, grasshopper: grasshopperboardapp,
   kilter: kilterboardapp, soill: soillboardapp, tension: tensionboardapp2, touchstone:
   touchstoneboardapp}` → host is `api.{value}.com`.
2. **Seeds** a base SQLite db (boardlib extracts it from the board's Android **APK**).
3. **Syncs** shared + user tables — `POST /sync` with `Cookie: token={token}`, form-encoded table
   names + `last_synchronized_at` watermarks; response carries `user_syncs` / `shared_syncs`.

The relevant **shared** tables for browsing climbs (Aurora schema):

| Table | Key columns we use |
|---|---|
| `climbs` | `uuid`, `layout_id`, `setter_username`, `name`, `description`, `frames` (hold string), `is_listed`, `is_draft`, `edge_*` |
| `climb_stats` | `climb_uuid`, `angle`, `display_difficulty`, `benchmark_difficulty`, `ascensionist_count`, `quality_average`, `difficulty_average` |
| `difficulty_grades` | `difficulty` (int), `boulder_name` (e.g. `"6C+/V5"`), `is_listed` |
| `layouts`, `products`, `product_sizes`, `sets`, `product_sizes_layouts_sets` | board-setup metadata for the layout/size filter |

A climb's displayed grade is `difficulty_grades.boulder_name` where
`difficulty = ROUND(climb_stats.display_difficulty)`, joined on
`climbs.uuid = climb_stats.climb_uuid`.

### Why a pure client-side app cannot replicate the download

- **CORS.** `api.kilterboardapp.com` et al. are **mobile-app** endpoints with **no
  `Access-Control-Allow-Origin`**. A browser `fetch()` from `harshal2802.github.io` is blocked at the
  network layer. Not fixable client-side.
- **Auth surface.** Replicating login means **collecting a user's board username/password** in a
  static page and shipping them to a third party — exactly the "no auth surface" the project forbids
  (`decisions.md` → *"No backend, fully client-side"*).
- **Schema seeding from an APK** is not a browser operation.

This is a hard architectural fork, surfaced to the user. **Decision (user, 2026-06-06): bundle full
snapshots of all Aurora boards**, support **all boards**, ship the **full explorer**, and **add a
filtered-`.db` export**.

## Constraints (Snappet standard + this app's specifics)

- **No backend / no runtime network to Aurora.** All querying is local.
- **Static-asset budget.** The PWA precache must not balloon. Board snapshots are **large** (Kilter
  alone is ~100k+ climbs once stats are joined). They must be **per-board, lazily fetched from
  `public/`, gzip-compressed, and excluded from the precache manifest** — same playbook as the
  workout app's `exercises.json` and the doc-viewer's tesseract assets.
- **`sql.js` WASM** (~1 MB) must also be lazy-loaded with `locateFile` → `public/`, never precached.
- **Staleness + provenance.** Bundled data is a point-in-time snapshot. Show a "data as of <date>"
  badge per board and document the refresh path. Credit Aurora Climbing + boardlib visibly.
- **Licensing.** Climb data is user-generated content hosted by Aurora. We ship a **derived,
  read-only snapshot for browsing**, attributed, with a documented regeneration script so the
  maintainer owns refreshes (not a redistribution of Aurora's app). Flag for maintainer review.
- **TypeScript strict, Tailwind only, mobile-first, `useLocalStorage`, `↺ Reset`, guided tour** —
  all standard.

## Approach decision: `sql.js` over a JSON blob

The filtered-**`.db`** export requirement is the deciding factor. Options:

- **Bundle JSON + filter in JS + hand-roll a SQLite writer** — would need a from-scratch SQLite file
  encoder to satisfy the `.db` export. Rejected (huge, error-prone).
- **Bundle real `.sqlite` per board + `sql.js`** — **chosen.** `sql.js` loads the bundled db, runs
  the filter `SELECT`, and for export we build a *new* in-memory db with only the matched climbs +
  their referenced lookup rows and call `db.export()` → `Uint8Array` → `Blob` download. The exported
  file is a valid, smaller Aurora-shaped SQLite that other tools (incl. boardlib consumers) can read.
  CSV/JSON fall out of the same result set trivially.

New dependency: **`sql.js`** (`^1.x`). One WASM file, MIT, no transitive bloat — consistent with how
`mp4box`/`pdfjs`/`tesseract.js` were added for video-editor/doc-viewer.

## Snapshot pipeline (maintainer, offline — NOT runtime)

`scripts/build-board-snapshots.py` (documented, run by the maintainer who has board logins):

1. For each board: `boardlib database <board> <tmp>/<board>.db --username <user>` (prompts password).
2. **Slim** it: keep only the columns the explorer needs; pre-join a `climb_browse` table/view
   (`uuid, name, setter_username, layout_id, angle, grade(boulder_name), grade_int, ascents,
   quality, benchmark, is_listed`) so the in-browser query is a simple indexed `SELECT … WHERE`.
   Drop user/ascent PII tables. `VACUUM`.
3. **gzip** → `src/frontend/public/board-data/<board>.sqlite.gz` + write
   `public/board-data/manifest.json` (`{board, climbs, generatedAt, gradeScale}`).

Runtime fetches `manifest.json` (tiny) eagerly; the per-board `.sqlite.gz` only when a board is
selected (`fetch` → `DecompressionStream('gzip')` → `sql.js`). Snapshots are **git-LFS or
release-asset** candidates if they exceed comfortable repo size — flag during build.

## Filters (map to boardlib/Aurora `explore` semantics)

Board · Layout + size · **Angle** · **Grade range** (min/max via `difficulty_grades`) · **Min
ascents** · **Min quality** (stars) · **Setter** (search) · **Name** search · **Benchmark only** ·
**Listed/public only** · sort (popularity / quality / grade / name). Saved-filter **presets** in
`localStorage` (`snappet:board-explorer:*`).

## Alternatives considered (rejected)

- **Live API via public CORS proxy** — violates no-backend/no-auth, unreliable, leaks credentials.
- **Import-your-own `.db` only** — empty until the user runs boardlib; user chose bundled snapshots.
- **Bundle as JSON, no SQLite** — can't satisfy the `.db` export cleanly (see above).

## Open questions for the maintainer

1. **Repo size / hosting** of the `.sqlite.gz` snapshots (in-repo vs git-LFS vs GitHub Release
   asset fetched at runtime). Sizing happens in Phase 1.
2. **Licensing/attribution** sign-off on shipping derived snapshots.
3. **Refresh cadence** (manual on demand vs a scheduled Action that runs boardlib with a secret
   login — the only place a credential would ever live, and it'd be a CI secret, never in the app).
