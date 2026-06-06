#!/usr/bin/env python3
"""Build a tiny, FULLY-SYNTHETIC Aurora-board catalog fixture for the Snappet web
Board Explorer (`/board-explorer`).

This file contains **zero Aurora Climbing data** — every row (a couple of invented
layouts, a small invented hole grid, a set of made-up climbs) is authored here by
hand. It exists so the in-browser sql.js reader, the filter queries, the `.db`
export, and the validator can be exercised without redistributing Aurora's
proprietary catalog. It mirrors, on the web side, what
`snappet-mobile/tools/kilter/build_test_fixture.py` does for the native app.

The schema deliberately matches the real Aurora SQLite shape (table + column names)
so the export produced by the app is schema-faithful and importable into
snappet-mobile's "Import catalog file…" flow.

Usage:
    python3 scripts/build-board-fixture.py            # builds kilter + tension fixtures
    python3 scripts/build-board-fixture.py --board kilter --out path.sqlite3

The default run writes gzipped fixtures + a manifest into
`src/frontend/public/board-data/`.
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

# (difficulty_int, boulder_name) — Kilter-style font/V dual labels.
GRADES = [
    (10, "5+/V0"), (11, "6A/V1"), (12, "6A+/V1"), (13, "6B/V2"), (14, "6B+/V3"),
    (15, "6C/V4"), (16, "6C+/V5"), (17, "7A/V6"), (18, "7A+/V7"), (19, "7B/V8"),
    (20, "7B+/V8"), (21, "7C/V9"), (22, "7C+/V10"), (23, "8A/V11"), (24, "8A+/V12"),
    (25, "8B/V13"), (26, "8B+/V14"), (27, "8C/V15"),
]
ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60]
LAYOUTS = [(1, "Kilter Board Original"), (8, "Kilter Board Homewall")]
SETTERS = ["asana", "boltz", "crimpmaster", "dyno_dan", "edgewalker", "flowstate", "gripfast"]
ADJ = ["Crimp", "Sloper", "Dyno", "Tension", "Flow", "Power", "Balance", "Edge", "Pocket", "Sting"]
NOUN = ["Sender", "Project", "Traverse", "Ladder", "Riddle", "Engine", "Cruise", "Storm", "Pulse", "Maze"]

# Holes laid out on a small invented grid (real boards are ~18x18; keep it tiny).
GRID = 8


def build(board: str, path: str, *, n_climbs: int = 240) -> None:
    if os.path.exists(path):
        os.remove(path)
    db = sqlite3.connect(path)
    c = db.cursor()
    c.executescript(
        """
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, is_listed INTEGER);
        CREATE TABLE product_sizes (id INTEGER PRIMARY KEY, product_id INTEGER, name TEXT, is_listed INTEGER);
        CREATE TABLE layouts (id INTEGER PRIMARY KEY, product_id INTEGER, name TEXT, is_listed INTEGER);
        CREATE TABLE sets (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE product_sizes_layouts_sets (
            id INTEGER PRIMARY KEY, product_size_id INTEGER, layout_id INTEGER, set_id INTEGER,
            image_filename TEXT, is_listed INTEGER);
        CREATE TABLE products_angles (product_id INTEGER, angle INTEGER);
        CREATE TABLE placement_roles (
            id INTEGER PRIMARY KEY, product_id INTEGER, position INTEGER, name TEXT,
            full_name TEXT, led_color TEXT, screen_color TEXT);
        CREATE TABLE holes (id INTEGER PRIMARY KEY, product_id INTEGER, name TEXT, x INTEGER, y INTEGER);
        CREATE TABLE holds (id INTEGER PRIMARY KEY, product_id INTEGER, name TEXT);
        CREATE TABLE placements (
            id INTEGER PRIMARY KEY, layout_id INTEGER, hole_id INTEGER, set_id INTEGER,
            default_placement_role_id INTEGER);
        CREATE TABLE leds (id INTEGER PRIMARY KEY, product_size_id INTEGER, hole_id INTEGER, position INTEGER);
        CREATE TABLE difficulty_grades (
            difficulty INTEGER PRIMARY KEY, boulder_name TEXT, route_name TEXT, is_listed INTEGER);
        CREATE TABLE climbs (
            uuid TEXT PRIMARY KEY, layout_id INTEGER, setter_id INTEGER, setter_username TEXT,
            name TEXT, description TEXT, hsm INTEGER, edge_left INTEGER, edge_right INTEGER,
            edge_bottom INTEGER, edge_top INTEGER, angle INTEGER, frames_count INTEGER,
            frames_pace INTEGER, frames TEXT, is_draft INTEGER, is_listed INTEGER, created_at TEXT);
        CREATE TABLE climb_stats (
            climb_uuid TEXT, angle INTEGER, display_difficulty REAL, benchmark_difficulty REAL,
            ascensionist_count INTEGER, difficulty_average REAL, quality_average REAL, fa_username TEXT,
            fa_at TEXT);
        CREATE TABLE climb_cache_fields (
            climb_uuid TEXT PRIMARY KEY, display_difficulty REAL, ascensionist_count INTEGER,
            quality_average REAL);
        CREATE TABLE beta_links (
            climb_uuid TEXT, link TEXT, foreign_username TEXT, angle INTEGER, thumbnail TEXT,
            is_listed INTEGER, created_at TEXT);
        CREATE INDEX climb_stats_climb_uuid ON climb_stats (climb_uuid);
        CREATE INDEX climbs_layout_id ON climbs (layout_id);
        """
    )

    c.execute("INSERT INTO products VALUES (1, ?, 1)", (f"{board.title()} Board",))
    c.execute("INSERT INTO product_sizes VALUES (1, 1, '12 x 12', 1)")
    c.executemany("INSERT INTO layouts VALUES (?, 1, ?, 1)", [(lid, name) for lid, name in LAYOUTS])
    c.execute("INSERT INTO sets VALUES (1, 'Default')")
    for lid, _ in LAYOUTS:
        c.execute(
            "INSERT INTO product_sizes_layouts_sets VALUES (NULL, 1, ?, 1, ?, 1)",
            (lid, f"product_sizes_layouts_sets/{lid}.png"),
        )
    c.executemany("INSERT INTO products_angles VALUES (1, ?)", [(a,) for a in ANGLES])
    roles = [
        (12, 1, 1, "start", "Start Hold", "00FF00", "00DD00"),
        (13, 1, 2, "middle", "Hand Hold", "00FFFF", "00BBFF"),
        (14, 1, 3, "finish", "Finish Hold", "FF00FF", "FF00CC"),
        (15, 1, 4, "foot", "Foot Hold", "FFA500", "FF8800"),
    ]
    c.executemany("INSERT INTO placement_roles VALUES (?,?,?,?,?,?,?)", roles)

    hole_id = 1
    placement_id = 1
    led_id = 1
    holes = []
    for gy in range(GRID):
        for gx in range(GRID):
            c.execute(
                "INSERT INTO holes VALUES (?, 1, ?, ?, ?)",
                (hole_id, f"{chr(65+gx)}{gy+1}", gx * 4 + 4, gy * 4 + 4),
            )
            for lid, _ in LAYOUTS:
                c.execute(
                    "INSERT INTO placements VALUES (?, ?, ?, 1, 13)",
                    (placement_id, lid, hole_id),
                )
                placement_id += 1
            c.execute("INSERT INTO leds VALUES (?, 1, ?, ?)", (led_id, hole_id, hole_id))
            led_id += 1
            holes.append(hole_id)
            hole_id += 1

    c.executemany(
        "INSERT INTO difficulty_grades VALUES (?, ?, ?, 1)",
        [(d, name, name, ) for d, name in GRADES],
    )

    # Deterministic pseudo-random without importing random: a simple LCG.
    seed = 1234567 if board == "kilter" else 7654321

    def rnd(mod: int) -> int:
        nonlocal seed
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        return seed % mod

    base = datetime(2021, 1, 1, tzinfo=timezone.utc).timestamp()
    for i in range(n_climbs):
        uuid = f"{board[0].upper()}{i:08X}-FIXTURE-0000-0000-000000000000"
        layout_id = LAYOUTS[rnd(len(LAYOUTS))][0]
        setter = SETTERS[rnd(len(SETTERS))]
        name = f"{ADJ[rnd(len(ADJ))]} {NOUN[rnd(len(NOUN))]} {i+1}"
        # ~12% multi-frame so the single-frame filter has something to exclude.
        frames_count = 2 if rnd(100) < 12 else 1
        # Frames: a few "p<placement>r<role>" tokens (only meaningful for frames_count==1).
        n_holds = 4 + rnd(6)
        frames = "".join(
            f"p{holes[rnd(len(holes))] * 2}r{roles[rnd(len(roles))][0]}" for _ in range(n_holds)
        )
        created = datetime.fromtimestamp(base + i * 3600, tz=timezone.utc).isoformat()
        c.execute(
            "INSERT INTO climbs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (uuid, layout_id, rnd(9999), setter, name, "", 0, 4, 156, 0, 156,
             0, frames_count, 0, frames, 0, 1, created),
        )
        # 1-3 angles per climb.
        n_ang = 1 + rnd(3)
        used = set()
        cache_set = False
        for _ in range(n_ang):
            angle = ANGLES[rnd(len(ANGLES))]
            if angle in used:
                continue
            used.add(angle)
            gmin, gmax = GRADES[0][0], GRADES[-1][0]
            difficulty = gmin + rnd(gmax - gmin + 1) + rnd(100) / 100.0
            ascents = 1 + rnd(900)
            quality = 1.0 + rnd(400) / 100.0  # 1.0 .. 5.0
            benchmark = difficulty if rnd(100) < 8 else None
            c.execute(
                "INSERT INTO climb_stats VALUES (?,?,?,?,?,?,?,?,?)",
                (uuid, angle, difficulty, benchmark, ascents, difficulty, quality,
                 setter if rnd(2) else None, created),
            )
            if not cache_set:
                c.execute(
                    "INSERT INTO climb_cache_fields VALUES (?,?,?,?)",
                    (uuid, difficulty, ascents, quality),
                )
                cache_set = True
        if rnd(100) < 15:
            c.execute(
                "INSERT INTO beta_links VALUES (?,?,?,?,?,1,?)",
                (uuid, f"https://example.invalid/beta/{i}", setter, ANGLES[rnd(len(ANGLES))], "", created),
            )

    db.commit()
    c.execute("VACUUM")
    db.commit()
    db.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--board", default=None, help="single board name (default: kilter+tension)")
    ap.add_argument("--out", default=None, help="output .sqlite3 path (single board only)")
    ap.add_argument("--no-gzip", action="store_true", help="write raw .sqlite3 instead of .sqlite.gz")
    args = ap.parse_args()

    boards = [args.board] if args.board else ["kilter", "tension"]
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = []
    for board in boards:
        tmp = os.path.join(OUT_DIR, f"{board}.sqlite3")
        build(board, tmp)
        raw = os.path.getsize(tmp)
        if args.out and args.board:
            os.replace(tmp, args.out)
            print(f"wrote {args.out} ({raw} bytes)")
            return
        if args.no_gzip:
            gz_path, gz_size = tmp, raw
        else:
            gz_path = os.path.join(OUT_DIR, f"{board}.sqlite.gz")
            with open(tmp, "rb") as fin, gzip.open(gz_path, "wb", compresslevel=9) as fout:
                fout.writelines(fin)
            gz_size = os.path.getsize(gz_path)
            os.remove(tmp)
        manifest.append({
            "board": board,
            "label": f"{board.title()} Board",
            "file": os.path.basename(gz_path),
            "climbs": 240,
            "generatedAt": datetime.now(timezone.utc).date().isoformat(),
            "isFixture": True,
            "importableToMobile": board == "kilter",
            "sizeBytesGz": gz_size,
            "sizeBytesRaw": raw,
        })
        print(f"built {board}: raw={raw} gz={gz_size}")

    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump({"generatedAt": datetime.now(timezone.utc).date().isoformat(),
                   "boards": manifest}, f, indent=2)
    print(f"wrote manifest with {len(manifest)} board(s)")


if __name__ == "__main__":
    main()
