#!/usr/bin/env python3
"""Build real Aurora-board snapshots for the Snappet web Board Explorer (maintainer-only).

This is the OFFLINE pipeline a maintainer runs to refresh the bundled board data.
It is NOT run at build time and NOT run in the browser — the web app only ever
reads the gzipped SQLite snapshots this produces.

It wraps `boardlib` (https://github.com/lemeryfertitta/BoardLib) to download a full
board database, then trims it to a self-contained, schema-faithful subset and
gzips it into `src/frontend/public/board-data/`.

  IMPORTANT — keep the trimming contract in sync with
  `snappet-mobile/tools/kilter/build_bundled_db.py`. The `.db` the web app exports
  must import into the mobile app's "Import catalog file…" flow (issue #42), so the
  set of tables and the climb-subset rules below mirror that script. If the mobile
  builder changes, update this file (and `validate.ts` / `schema.ts` on the web).

Prerequisites:
    python3 -m pip install boardlib

Usage (per board):
    # 1. Download the full board db (Aurora login may be required for some boards):
    boardlib database kilter /tmp/kilter-full.sqlite3
    # 2. Trim + gzip into public/board-data/:
    python3 scripts/build-board-snapshots.py --board kilter --source /tmp/kilter-full.sqlite3

Notes:
  * The WEB snapshot keeps a high / no climb cap (the user filters in-browser) and
    does NOT apply the mobile-only `layout_id IN (1,8)` / `frames_count = 1`
    restrictions — those are applied at EXPORT time in the app per the user's chosen
    mode, so the snapshot must retain the superset.
  * Reference / geometry tables are copied WHOLE; only the climb tables are subset.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sqlite3
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "src", "frontend", "public", "board-data")

# Copied whole — small, and the reader needs them all for board geometry / LEDs.
# (Mirrors FULL_TABLES in snappet-mobile/tools/kilter/build_bundled_db.py.)
FULL_TABLES = [
    "difficulty_grades", "products", "product_sizes", "layouts", "sets",
    "product_sizes_layouts_sets", "products_angles", "placement_roles",
    "holes", "holds", "placements", "leds",
]
# Subset by climb uuid. (Mirrors CLIMB_TABLES.)
CLIMB_TABLES = {
    "climbs": "uuid",
    "climb_stats": "climb_uuid",
    "climb_cache_fields": "climb_uuid",
    "beta_links": "climb_uuid",
}


def table_exists(cur: sqlite3.Cursor, name: str) -> bool:
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


def copy_schema(src: sqlite3.Cursor, dst: sqlite3.Cursor, names: list[str]) -> None:
    """Recreate each table/index from its original CREATE … DDL (schema-faithful)."""
    for name in names:
        src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (name,))
        row = src.fetchone()
        if row and row[0]:
            dst.execute(row[0])


def copy_indexes(src: sqlite3.Cursor, dst: sqlite3.Cursor, names: set[str]) -> None:
    src.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
    for _idx, tbl, sql in src.fetchall():
        if tbl in names:
            dst.execute(sql)


def trim(source: str, out: str, *, limit: int) -> int:
    if os.path.exists(out):
        os.remove(out)
    src = sqlite3.connect(source)
    dst = sqlite3.connect(out)
    sc, dc = src.cursor(), dst.cursor()

    present_full = [t for t in FULL_TABLES if table_exists(sc, t)]
    present_climb = [t for t in CLIMB_TABLES if table_exists(sc, t)]
    copy_schema(sc, dc, present_full + present_climb)

    # Reference/geometry tables: copy whole.
    for t in present_full:
        sc.execute(f"SELECT * FROM {t}")
        rows = sc.fetchall()
        if rows:
            ph = ",".join("?" * len(rows[0]))
            dc.executemany(f"INSERT INTO {t} VALUES ({ph})", rows)

    # Resolve the climb uuids to keep: listed climbs, most-climbed first.
    cap = f"LIMIT {limit}" if limit and limit > 0 else ""
    sc.execute(
        f"""
        SELECT c.uuid FROM climbs c
        JOIN climb_stats cs ON cs.climb_uuid = c.uuid
        WHERE c.is_listed = 1
        GROUP BY c.uuid
        ORDER BY MAX(cs.ascensionist_count) DESC
        {cap}
        """
    )
    uuids = [r[0] for r in sc.fetchall()]
    dc.execute("CREATE TEMP TABLE _keep (uuid TEXT PRIMARY KEY)")
    dc.executemany("INSERT INTO _keep VALUES (?)", [(u,) for u in uuids])

    keep = set(uuids)
    for t, key in CLIMB_TABLES.items():
        if t not in present_climb:
            continue
        sc.execute(f"SELECT * FROM {t}")
        cols = [d[0] for d in sc.description]
        key_idx = cols.index(key)
        rows = [r for r in sc.fetchall() if r[key_idx] in keep]
        if rows:
            ph = ",".join("?" * len(cols))
            dc.executemany(f"INSERT INTO {t} VALUES ({ph})", rows)

    dc.execute("DROP TABLE _keep")
    copy_indexes(sc, dc, set(present_full + present_climb))
    dst.commit()
    dc.execute("VACUUM")
    dst.commit()
    src.close()
    dst.close()
    return len(uuids)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--board", required=True, help="board name, e.g. kilter / tension")
    ap.add_argument("--source", required=True, help="full boardlib .sqlite3 (from `boardlib database`)")
    ap.add_argument("--limit", type=int, default=0, help="max climbs (0 = no cap; user filters in-browser)")
    ap.add_argument("--importable-to-mobile", action="store_true",
                    help="mark this board as importable into snappet-mobile (Kilter today)")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = os.path.join(OUT_DIR, f"{args.board}.sqlite3")
    kept = trim(args.source, tmp, limit=args.limit)
    raw = os.path.getsize(tmp)
    gz_path = os.path.join(OUT_DIR, f"{args.board}.sqlite.gz")
    with open(tmp, "rb") as fin, gzip.open(gz_path, "wb", compresslevel=9) as fout:
        fout.writelines(fin)
    gz_size = os.path.getsize(gz_path)
    os.remove(tmp)
    print(f"trimmed {args.board}: kept {kept} climbs · raw={raw} gz={gz_size}")

    # Merge into manifest.json (preserve other boards' entries).
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    data = {"generatedAt": datetime.now(timezone.utc).date().isoformat(), "boards": []}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            data = json.load(f)
    boards = [b for b in data.get("boards", []) if b.get("board") != args.board]
    boards.append({
        "board": args.board,
        "label": f"{args.board.title()} Board",
        "file": os.path.basename(gz_path),
        "climbs": kept,
        "generatedAt": datetime.now(timezone.utc).date().isoformat(),
        "isFixture": False,
        "importableToMobile": bool(args.importable_to_mobile),
        "sizeBytesGz": gz_size,
        "sizeBytesRaw": raw,
    })
    data["boards"] = boards
    data["generatedAt"] = datetime.now(timezone.utc).date().isoformat()
    with open(manifest_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"updated manifest ({len(boards)} board(s))")


if __name__ == "__main__":
    main()
