#!/usr/bin/env python3
"""Turn a bundled Aurora-board snapshot into a tokenized, size-aware training set
for a *conditional climb generator* (research scaffold — maintainer-only, offline).

This is the data-prep + tokenizer stage of the experiment described in
`pdd/context/research/kilter-climb-generator.md`. It is NOT run at build time and
NOT run in the browser — it reads the same gzipped SQLite snapshot the web Board
Explorer ships (`src/frontend/public/board-data/<board>.sqlite.gz`) and emits the
artifacts a model-training notebook consumes:

    out/
      vocab.json         token <-> id, plus geometry/role/size metadata (self-describing)
      size_masks.json    per board SIZE: the hold-token ids physically present on that size
      dataset.train.jsonl \
      dataset.val.jsonl    } one example per (climb x angle), split by climb uuid (no leakage)
      dataset.test.jsonl  /
      meta.json          run parameters + the size table + counts (reproducibility)
      stats.json         distributions per size / grade / angle / split (sanity)

A "climb" is an unordered set of holds, each a (placement, role) where role is one
of start / middle / finish / foot. We turn that into a conditioned token sequence:

    [BOS] [SIZE=8x12] [ANGLE=40] [GRADE=V5]  H..  H..  ..  [EOS]

The two SIZE mechanisms the research doc calls for are produced here:
  1. SIZE conditioning token  -> prepended to every example (style per board size).
  2. per-size hold mask        -> size_masks.json, so generation can be constrained
     to only the holds that physically exist on the requested board size.

Board SIZE is first-class. A size is a rectangle (edge_left/right/bottom/top) in the
SAME units as holes.x/y; a climb fits a size iff its own bounding box is contained
in the size's box. Each example is labelled with its *minimum-fit size* (the smallest
standard size that still contains it) — the setter's effective board.

stdlib only (sqlite3, gzip, json, hashlib, re). No third-party deps, like the other
maintainer scripts here.

Usage:
    # default: Kilter Original (layout 1) from the committed snapshot
    python3 scripts/build-climb-dataset.py

    # crowd-validated subset only (>=5 ascents), quick smoke run of 5k examples
    python3 scripts/build-climb-dataset.py --min-ascents 5 --limit 5000

    # Kilter Homewall (layout 8), custom output dir
    python3 scripts/build-climb-dataset.py --layout 8 --out /tmp/homewall

    # validate the pure encode/ordering/mask logic without touching a DB
    python3 scripts/build-climb-dataset.py --self-test
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import sqlite3
import tempfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SOURCE = os.path.join(HERE, "..", "src", "frontend", "public", "board-data", "kilter.sqlite.gz")
DEFAULT_OUT = os.path.join(HERE, "out", "climb-dataset")

FRAME_RE = re.compile(r"p(\d+)r(\d+)")

# Canonical sequence order: starts first, finish last, the body bottom->top in
# between. The role is carried in the token, so within the body we only need a
# deterministic tie-break (y, then x, then ids).
_START, _BODY, _FINISH = 0, 1, 2


def role_rank(role_name: str) -> int:
    if role_name == "start":
        return _START
    if role_name == "finish":
        return _FINISH
    return _BODY


# ─────────────────────────── pure encode logic ───────────────────────────────
# Everything below is DB-free and deterministic — easy to port to TS for the
# in-browser tokenizer, and exercised by --self-test.

def parse_frames(frames: str) -> list[tuple[int, int]]:
    """`"p1235r7p1259r4"` -> `[(1235, 7), (1259, 4)]` (placement_id, role_id)."""
    return [(int(p), int(r)) for p, r in FRAME_RE.findall(frames or "")]


def bbox(holds: list[tuple[int, int]], xy: dict[int, tuple[int, int]]) -> tuple[int, int, int, int]:
    """Tight bounding box (left, right, bottom, top) of a climb's holds."""
    pts = [xy[p] for p, _ in holds if p in xy]
    xs = [x for x, _ in pts]
    ys = [y for _, y in pts]
    return (min(xs), max(xs), min(ys), max(ys))


def box_contains(box: tuple[int, int, int, int], bb: tuple[int, int, int, int]) -> bool:
    """Does size `box`=(L,R,B,T) fully contain climb bbox `bb`=(l,r,b,t)?"""
    L, R, B, T = box
    l, r, b, t = bb
    return L <= l and r <= R and B <= b and t <= T


def min_fit_size(bb: tuple[int, int, int, int], sizes: list[dict]) -> dict | None:
    """Smallest (by area) standard size whose box contains the climb's bbox."""
    for s in sorted(sizes, key=lambda s: s["area"]):
        if box_contains(s["box"], bb):
            return s
    return None


def canonical_order(
    holds: list[tuple[int, int]],
    role_name: dict[int, str],
    xy: dict[int, tuple[int, int]],
) -> list[tuple[int, int]]:
    """Deterministic hold order: start(s), then body bottom->top, then finish."""
    def key(h: tuple[int, int]):
        p, r = h
        x, y = xy.get(p, (0, 0))
        return (role_rank(role_name.get(r, "middle")), y, x, p, r)

    return sorted(holds, key=key)


def is_well_formed(holds: list[tuple[int, int]], role_name: dict[int, str]) -> bool:
    """A trainable climb has at least one start and one finish hold."""
    names = {role_name.get(r, "middle") for _, r in holds}
    return "start" in names and "finish" in names


SPECIALS = ["PAD", "BOS", "EOS"]


def build_vocab(
    hold_pairs: set[tuple[int, int]],
    sizes: list[dict],
    angles: list[int],
    grades: list[int],
) -> dict:
    """Single id-space: specials, then SIZE/ANGLE/GRADE conditioners, then holds.
    Returns a self-describing dict (token<->id + the metadata a renderer needs)."""
    tokens: list[str] = list(SPECIALS)
    tokens += [f"SIZE_{s['id']}" for s in sizes]
    tokens += [f"ANGLE_{a}" for a in angles]
    tokens += [f"GRADE_{g}" for g in grades]
    # Holds last so the contiguous tail [first_hold_id .. EOS-of-vocab) is the only
    # range a constrained decoder ever samples from.
    hold_tokens = [f"HOLD_{p}_{r}" for p, r in sorted(hold_pairs)]
    tokens += hold_tokens
    stoi = {t: i for i, t in enumerate(tokens)}
    return {
        "stoi": stoi,
        "itos": tokens,
        "specials": SPECIALS,
        "first_hold_id": stoi[hold_tokens[0]] if hold_tokens else len(tokens),
        "size_token": {s["id"]: stoi[f"SIZE_{s['id']}"] for s in sizes},
        "angle_token": {a: stoi[f"ANGLE_{a}"] for a in angles},
        "grade_token": {g: stoi[f"GRADE_{g}"] for g in grades},
    }


def build_size_masks(
    vocab: dict,
    sizes: list[dict],
    xy: dict[int, tuple[int, int]],
) -> dict:
    """For each size, the hold-token ids whose placement physically sits in the box
    (plus EOS). This is the geometric mask a constrained decoder applies so every
    generated climb fits the requested board size."""
    stoi = vocab["stoi"]
    eos = stoi["EOS"]
    masks: dict[str, dict] = {}
    for s in sizes:
        allowed = [eos]
        for tok, tid in stoi.items():
            if not tok.startswith("HOLD_"):
                continue
            pid = int(tok.split("_")[1])
            if pid in xy and box_contains(s["box"], (xy[pid][0], xy[pid][0], xy[pid][1], xy[pid][1])):
                allowed.append(tid)
        masks[str(s["id"])] = {
            "name": s["name"],
            "box": list(s["box"]),
            "allowed_token_ids": sorted(allowed),
            "n_holds": len(allowed) - 1,
        }
    return masks


def encode_example(
    holds_ordered: list[tuple[int, int]],
    size_id: int,
    angle: int,
    grade: int,
    vocab: dict,
) -> list[int]:
    """(ordered holds, conditioners) -> token-id sequence with BOS/SIZE/ANGLE/GRADE … EOS."""
    stoi = vocab["stoi"]
    seq = [stoi["BOS"], stoi[f"SIZE_{size_id}"], stoi[f"ANGLE_{angle}"], stoi[f"GRADE_{grade}"]]
    seq += [stoi[f"HOLD_{p}_{r}"] for p, r in holds_ordered]
    seq.append(stoi["EOS"])
    return seq


def split_of(uuid: str, salt: str, val_frac: float, test_frac: float) -> str:
    """Deterministic per-uuid split so every angle of a climb lands together."""
    h = int(hashlib.sha1((uuid + salt).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    if h < test_frac:
        return "test"
    if h < test_frac + val_frac:
        return "val"
    return "train"


# ───────────────────────────── DB + orchestration ────────────────────────────

def open_snapshot(source: str) -> tuple[sqlite3.Connection, str | None]:
    """Open a .sqlite or .sqlite.gz snapshot (gz is decompressed to a temp file)."""
    with open(source, "rb") as f:
        magic = f.read(2)
    if magic == b"\x1f\x8b":  # gzip
        tmp = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
        with gzip.open(source, "rb") as fin:
            tmp.write(fin.read())
        tmp.close()
        return sqlite3.connect(tmp.name), tmp.name
    return sqlite3.connect(source), None


def load_reference(cur: sqlite3.Cursor, layout: int) -> dict:
    """Roles, the placement->(x,y) grid for this layout, grade labels, and the size
    table for the layout's product (deduped by geometry)."""
    cur.execute("SELECT id, name FROM placement_roles")
    role_name = {rid: name for rid, name in cur.fetchall()}

    cur.execute(
        "SELECT p.id, h.x, h.y FROM placements p JOIN holes h ON h.id = p.hole_id WHERE p.layout_id = ?",
        (layout,),
    )
    xy = {pid: (x, y) for pid, x, y in cur.fetchall()}

    cur.execute("SELECT difficulty, boulder_name FROM difficulty_grades")
    grade_label = {d: n for d, n in cur.fetchall()}

    cur.execute("SELECT product_id FROM layouts WHERE id = ?", (layout,))
    row = cur.fetchone()
    product_id = row[0] if row else None

    cur.execute(
        """SELECT id, name, description, edge_left, edge_right, edge_bottom, edge_top, position
           FROM product_sizes WHERE product_id = ? AND is_listed = 1 ORDER BY position""",
        (product_id,),
    )
    sizes: list[dict] = []
    seen_box: dict[tuple, dict] = {}
    for sid, name, desc, L, R, B, T in [(r[0], r[1], r[2], r[3], r[4], r[5], r[6]) for r in cur.fetchall()]:
        box = (L, R, B, T)
        if box in seen_box:  # merge LED-kit variants that share geometry
            seen_box[box]["aliases"].append(name)
            continue
        n_in_box = sum(1 for (x, y) in xy.values() if L <= x <= R and B <= y <= T)
        s = {
            "id": sid, "name": name, "description": desc, "box": box,
            "area": (R - L) * (T - B), "holds_in_box": n_in_box, "aliases": [],
        }
        seen_box[box] = s
        sizes.append(s)
    return {"role_name": role_name, "xy": xy, "grade_label": grade_label,
            "product_id": product_id, "sizes": sizes}


def iter_examples(cur: sqlite3.Cursor, layout: int, min_ascents: int):
    cur.execute(
        """SELECT c.uuid, c.frames, cs.angle, cs.display_difficulty,
                  cs.quality_average, cs.ascensionist_count
           FROM climbs c JOIN climb_stats cs ON cs.climb_uuid = c.uuid
           WHERE c.is_listed = 1 AND c.frames_count = 1 AND c.layout_id = ?
                 AND cs.display_difficulty IS NOT NULL AND cs.ascensionist_count >= ?""",
        (layout, min_ascents),
    )
    while True:
        rows = cur.fetchmany(20000)
        if not rows:
            return
        yield from rows


def build(args) -> None:
    os.makedirs(args.out, exist_ok=True)
    conn, tmp = open_snapshot(args.source)
    cur = conn.cursor()
    ref = load_reference(cur, args.layout)
    role_name, xy, grade_label, sizes = ref["role_name"], ref["xy"], ref["grade_label"], ref["sizes"]
    if not sizes:
        raise SystemExit(f"no listed product_sizes for layout {args.layout} (product {ref['product_id']})")
    print(f"layout {args.layout}: {len(xy)} placements, {len(sizes)} sizes, product {ref['product_id']}")
    for s in sizes:
        print(f"  size {s['id']:>2} {s['name']:<26} box={s['box']} holds_in_box={s['holds_in_box']}")

    # Pass 1 — decode, validate, label with min-fit size, collect the vocab universe.
    records: list[dict] = []
    hold_pairs: set[tuple[int, int]] = set()
    angles, grades = set(), set()
    skipped_illformed = skipped_oversize = skipped_long = 0
    for uuid, frames, angle, disp, quality, ascents in iter_examples(cur, args.layout, args.min_ascents):
        holds = parse_frames(frames)
        if not holds or not is_well_formed(holds, role_name):
            skipped_illformed += 1
            continue
        if len(holds) > args.max_len:
            skipped_long += 1
            continue
        size = min_fit_size(bbox(holds, xy), sizes)
        if size is None:
            skipped_oversize += 1
            continue
        grade = int(round(disp))
        ordered = canonical_order(holds, role_name, xy)
        records.append({
            "uuid": uuid, "angle": int(angle), "grade": grade,
            "grade_label": grade_label.get(grade, str(grade)),
            "size": size["id"], "size_name": size["name"],
            "quality": round(quality, 4) if quality is not None else None,
            "ascents": int(ascents), "holds": ordered,
        })
        hold_pairs.update(ordered)
        angles.add(int(angle))
        grades.add(grade)
        if args.limit and len(records) >= args.limit:
            break

    if not records:
        raise SystemExit("no examples matched — relax --min-ascents / check --layout")

    vocab = build_vocab(hold_pairs, sizes, sorted(angles), sorted(grades))
    masks = build_size_masks(vocab, sizes, xy)

    # Pass 2 — encode + write the split jsonl files.
    counts = {"train": 0, "val": 0, "test": 0}
    by_size: dict[str, int] = {}
    by_grade: dict[str, int] = {}
    by_angle: dict[str, int] = {}
    writers = {s: open(os.path.join(args.out, f"dataset.{s}.jsonl"), "w") for s in counts}
    for rec in records:
        split = split_of(rec["uuid"], args.seed_salt, args.val_frac, args.test_frac)
        tokens = encode_example(rec["holds"], rec["size"], rec["angle"], rec["grade"], vocab)
        line = {
            "uuid": rec["uuid"], "size": rec["size"], "size_name": rec["size_name"],
            "angle": rec["angle"], "grade": rec["grade"], "grade_label": rec["grade_label"],
            "quality": rec["quality"], "ascents": rec["ascents"],
            "n_holds": len(rec["holds"]), "tokens": tokens,
        }
        if args.keep_holds:
            line["holds"] = rec["holds"]
        writers[split].write(json.dumps(line) + "\n")
        counts[split] += 1
        by_size[rec["size_name"]] = by_size.get(rec["size_name"], 0) + 1
        by_grade[rec["grade_label"]] = by_grade.get(rec["grade_label"], 0) + 1
        by_angle[str(rec["angle"])] = by_angle.get(str(rec["angle"]), 0) + 1
    for w in writers.values():
        w.close()

    sizes_meta = [{k: v for k, v in s.items()} for s in sizes]
    for s in sizes_meta:
        s["box"] = list(s["box"])
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": os.path.relpath(args.source, os.path.join(HERE, "..")),
        "layout": args.layout, "product_id": ref["product_id"],
        "min_ascents": args.min_ascents, "max_len": args.max_len,
        "val_frac": args.val_frac, "test_frac": args.test_frac, "seed_salt": args.seed_salt,
        "vocab_size": len(vocab["itos"]), "n_hold_tokens": len(hold_pairs),
        "n_examples": len(records), "splits": counts,
        "skipped": {"illformed": skipped_illformed, "oversize": skipped_oversize, "too_long": skipped_long},
        "sizes": sizes_meta,
    }
    stats = {"by_size": by_size, "by_grade": by_grade, "by_angle": by_angle}

    with open(os.path.join(args.out, "vocab.json"), "w") as f:
        json.dump(vocab, f, indent=2)
    with open(os.path.join(args.out, "size_masks.json"), "w") as f:
        json.dump(masks, f, indent=2)
    with open(os.path.join(args.out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    with open(os.path.join(args.out, "stats.json"), "w") as f:
        json.dump(stats, f, indent=2)

    conn.close()
    if tmp:
        os.remove(tmp)

    print(f"\nexamples={len(records)}  vocab={len(vocab['itos'])} ({len(hold_pairs)} hold tokens)")
    print(f"splits: train={counts['train']} val={counts['val']} test={counts['test']}")
    print(f"skipped: illformed={skipped_illformed} oversize={skipped_oversize} too_long={skipped_long}")
    print("by min-fit size:")
    for name, n in sorted(by_size.items(), key=lambda kv: -kv[1]):
        print(f"  {name:<28} {n}")
    print(f"\nwrote {args.out}/  (vocab.json, size_masks.json, dataset.*.jsonl, meta.json, stats.json)")


def self_test() -> None:
    """Exercise the pure encode/ordering/mask logic on a tiny synthetic board."""
    # 3 placements on a line; roles 1=start 2=middle 3=finish 4=foot.
    xy = {10: (0, 0), 11: (50, 50), 12: (100, 100), 13: (50, 10)}
    role_name = {1: "start", 2: "middle", 3: "finish", 4: "foot"}
    sizes = [
        {"id": 1, "name": "small", "box": (0, 60, 0, 60), "area": 3600},
        {"id": 2, "name": "big", "box": (0, 100, 0, 100), "area": 10000},
    ]
    holds = [(12, 3), (10, 1), (11, 2), (13, 4)]  # deliberately unordered

    assert parse_frames("p10r1p11r2") == [(10, 1), (11, 2)]
    assert is_well_formed(holds, role_name) and not is_well_formed([(11, 2)], role_name)

    ordered = canonical_order(holds, role_name, xy)
    assert ordered[0] == (10, 1) and ordered[-1] == (12, 3), ordered  # start first, finish last
    assert ordered[1:3] == [(13, 4), (11, 2)], ordered  # body bottom->top (y=10 before y=50)

    assert bbox(holds, xy) == (0, 100, 0, 100)
    assert min_fit_size(bbox(holds, xy), sizes)["id"] == 2  # spans to (100,100) -> big
    assert min_fit_size((0, 50, 0, 50), sizes)["id"] == 1  # fits small

    vocab = build_vocab(set(holds), sizes, angles=[40], grades=[20])
    seq = encode_example(ordered, size_id=2, angle=40, grade=20, vocab=vocab)
    itos = vocab["itos"]
    assert itos[seq[0]] == "BOS" and itos[seq[1]] == "SIZE_2"
    assert itos[seq[2]] == "ANGLE_40" and itos[seq[3]] == "GRADE_20"
    assert itos[seq[-1]] == "EOS"
    assert all(itos[t].startswith("HOLD_") for t in seq[4:-1])

    masks = build_size_masks(vocab, sizes, xy)
    small_ids = set(masks["1"]["allowed_token_ids"])
    # placement 12 at (100,100) is outside the small box -> none of its hold tokens allowed.
    assert vocab["stoi"]["HOLD_12_3"] not in small_ids
    assert vocab["stoi"]["HOLD_10_1"] in small_ids
    assert masks["2"]["n_holds"] >= masks["1"]["n_holds"]  # bigger box, >= holds
    print("self-test OK — ordering, bbox, min-fit size, vocab, encode, and size masks all pass")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", default=DEFAULT_SOURCE, help="board snapshot (.sqlite or .sqlite.gz)")
    ap.add_argument("--layout", type=int, default=1, help="layout id (Kilter: 1=Original, 8=Homewall)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output directory")
    ap.add_argument("--min-ascents", type=int, default=0,
                    help="drop (climb,angle) examples below this ascensionist_count (>=5 = crowd-validated)")
    ap.add_argument("--max-len", type=int, default=60, help="drop climbs with more holds than this")
    ap.add_argument("--limit", type=int, default=0, help="cap examples (0 = all; for quick smoke runs)")
    ap.add_argument("--val-frac", type=float, default=0.1, help="validation fraction (split by uuid)")
    ap.add_argument("--test-frac", type=float, default=0.1, help="test fraction (split by uuid)")
    ap.add_argument("--seed-salt", default="kilter-gen-v1", help="salt for the deterministic uuid split")
    ap.add_argument("--keep-holds", action="store_true", help="also write raw [pid,rid] holds per example")
    ap.add_argument("--self-test", action="store_true", help="run the DB-free logic checks and exit")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return
    build(args)


if __name__ == "__main__":
    main()
