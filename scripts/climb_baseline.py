#!/usr/bin/env python3
"""A CPU, no-deps* baseline climb generator + renderer (research scaffold).

Given a spec — board SIZE, wall ANGLE, target GRADE, and MATCH/NOMATCH — sample a
*new* Kilter climb and draw it on the board. This is the **baseline the real model
must beat** (the conditional transformer in
`pdd/context/research/kilter-climb-generator.md`), and a way to exercise the whole
loop end to end with zero training infra: spec in → holds out → board image.

How it works (deliberately simple): from the dataset that
`scripts/build-climb-dataset.py` produced, it builds a **Markov bigram over the
canonical-ordered hold sequence**, bucketed by (grade window, match/no-match). It
samples under hard constraints — the **per-size hold mask** (so the climb physically
fits the board), no duplicate placement, and a structural repair guaranteeing ≥1
start and ≥1 finish — then renders the result. A tiny char-level Markov over
`names.txt` suggests a name. None of this is "good" the way a trained model will be;
it just produces valid, on-spec, novel-ish climbs to measure against.

* Rendering uses Pillow if available (`pip install Pillow`); otherwise it writes an
  SVG instead. Everything else is stdlib.

Usage:
    # 1. Build the dataset artifacts first (once):
    python3 scripts/build-climb-dataset.py --min-ascents 5
    # 2. Generate + render a climb:
    python3 scripts/climb_baseline.py --size 10 --angle 40 --grade 20 --nomatch 0
    python3 scripts/climb_baseline.py --grade 23 --nomatch 1 --out /tmp/hard.png
"""
from __future__ import annotations

import argparse
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA = os.path.join(HERE, "out", "climb-dataset")


def load_json(path: str):
    with open(path) as f:
        return json.load(f)


def read_dataset(path: str):
    with open(path) as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


# ───────────────────────────── hold-sequence model ───────────────────────────

def weighted_choice(rng: random.Random, dist: dict[int, float], temperature: float) -> int:
    items = list(dist.items())
    weights = [max(w, 1e-9) ** (1.0 / max(temperature, 1e-3)) for _, w in items]
    return rng.choices([k for k, _ in items], weights=weights, k=1)[0]


def build_bucket(rows, first_hold_id, bos, eos, *, grade, window, nomatch):
    """Bigram transitions + unigram/start/finish frequencies over the hold sequences
    of training climbs in the (grade±window, nomatch) bucket."""
    trans: dict[int, dict[int, float]] = {}
    unigram: dict[int, float] = {}
    n = 0
    for r in rows:
        if r["nomatch"] != nomatch or abs(r["grade"] - grade) > window:
            continue
        holds = [t for t in r["tokens"] if t >= first_hold_id]
        if not holds:
            continue
        n += 1
        seq = [bos] + holds + [eos]
        for a, b in zip(seq, seq[1:]):
            trans.setdefault(a, {})[b] = trans.setdefault(a, {}).get(b, 0) + 1
        for t in holds:
            unigram[t] = unigram.get(t, 0) + 1
    return trans, unigram, n


def sample_climb(rng, trans, unigram, *, bos, eos, allowed, placement_of, role_of,
                 starts, finishes, min_holds, max_holds, temperature):
    """Sample a hold set under the size mask + no-dup + structural constraints."""
    def cands_from(dist):
        out = {}
        for tok, w in dist.items():
            if tok == eos or tok not in allowed:
                continue
            if placement_of[tok] in used:
                continue
            out[tok] = w
        return out

    seq: list[int] = []
    used: set[int] = set()
    have_start = have_finish = False
    cur = bos
    for _ in range(max_holds):
        dist = trans.get(cur, {})
        cands = cands_from(dist) or cands_from(unigram)
        eligible = have_start and have_finish and len(seq) >= min_holds
        if eligible:
            cands = dict(cands)
            cands[eos] = max(dist.get(eos, 0), 0.5)  # let the model choose to stop
        if not cands:
            break
        nxt = weighted_choice(rng, cands, temperature)
        if nxt == eos:
            break
        seq.append(nxt)
        used.add(placement_of[nxt])
        have_start = have_start or role_of[nxt] == "start"
        have_finish = have_finish or role_of[nxt] == "finish"
        cur = nxt

    # Repair: guarantee at least one start and one finish hold.
    def add_role(freq):
        for tok, _ in sorted(freq.items(), key=lambda kv: -kv[1]):
            if tok in allowed and placement_of[tok] not in used:
                seq.append(tok)
                used.add(placement_of[tok])
                return True
        return False

    if not have_start:
        add_role(starts)
    if not have_finish:
        add_role(finishes)
    return seq


# ───────────────────────────── char-level name model ─────────────────────────

def name_model(names: list[str], k: int = 3):
    START, END = "\x02", "\x03"
    trans: dict[str, dict[str, float]] = {}
    for nm in names:
        s = START * k + nm + END
        for i in range(k, len(s)):
            ctx = s[i - k : i]
            trans.setdefault(ctx, {})[s[i]] = trans.setdefault(ctx, {}).get(s[i], 0) + 1
    return trans, k


def sample_name(rng, model, *, max_len=34) -> str:
    trans, k = model
    START, END = "\x02", "\x03"
    out = ""
    ctx = START * k
    for _ in range(max_len):
        dist = trans.get(ctx)
        if not dist:
            break
        ch = weighted_choice_str(rng, dist)
        if ch == END:
            break
        out += ch
        ctx = (ctx + ch)[-k:]
    return out.strip() or "Untitled"


def weighted_choice_str(rng: random.Random, dist: dict[str, float]) -> str:
    items = list(dist.items())
    return rng.choices([k for k, _ in items], weights=[w for _, w in items], k=1)[0]


# ─────────────────────────────────── render ──────────────────────────────────

def render(holds_xy_color, grid_xy, box, out_path, label):
    """Draw the board with Pillow; fall back to a self-contained SVG if unavailable."""
    xs = [x for x, _ in grid_xy] or [0, 100]
    ys = [y for _, y in grid_xy] or [0, 100]
    minX, maxX, minY, maxY = min(xs), max(xs), min(ys), max(ys)
    fy = lambda y: (minY + maxY) - y
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return _render_svg(holds_xy_color, grid_xy, box, out_path, minX, maxX, minY, maxY, fy)
    S, PAD = 6, 14
    sx = lambda x: int((x - minX + PAD) * S)
    sy = lambda y: int((fy(y) - minY + PAD) * S)
    W, H = int((maxX - minX + 2 * PAD) * S), int((maxY - minY + 2 * PAD) * S)
    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    for x, y in grid_xy:
        r = S * 1.5
        d.ellipse([sx(x) - r, sy(y) - r, sx(x) + r, sy(y) + r], fill=(214, 218, 224))
    if box:
        L, R, B, T = box
        d.rectangle([sx(L), sy(T), sx(R), sy(B)], outline=(150, 150, 150), width=2)
    for x, y, col in holds_xy_color:
        rr = S * 2.9
        rgb = tuple(int(col[i : i + 2], 16) for i in (0, 2, 4))
        d.ellipse([sx(x) - rr, sy(y) - rr, sx(x) + rr, sy(y) + rr], outline=rgb, width=int(S * 1.3))
    img.save(out_path)
    return out_path


def _render_svg(holds_xy_color, grid_xy, box, out_path, minX, maxX, minY, maxY, fy):
    out_path = os.path.splitext(out_path)[0] + ".svg"
    PAD = 10
    w, h = maxX - minX, maxY - minY
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minX-PAD} {minY-PAD} {w+2*PAD} {h+2*PAD}">']
    parts.append(f'<rect x="{minX-PAD}" y="{minY-PAD}" width="{w+2*PAD}" height="{h+2*PAD}" fill="white"/>')
    r = max(w, h) / 55
    for x, y in grid_xy:
        parts.append(f'<circle cx="{x}" cy="{fy(y)}" r="{r*0.42}" fill="#d6dae0"/>')
    if box:
        L, R, B, T = box
        parts.append(f'<rect x="{L}" y="{fy(T)}" width="{R-L}" height="{T-B}" fill="none" stroke="#999" stroke-width="{r*0.35}" stroke-dasharray="{r} {r}"/>')
    for x, y, col in holds_xy_color:
        parts.append(f'<circle cx="{x}" cy="{fy(y)}" r="{r*1.15}" fill="none" stroke="#{col}" stroke-width="{r*0.55}"/>')
    parts.append("</svg>")
    with open(out_path, "w") as f:
        f.write("\n".join(parts))
    return out_path


# ──────────────────────────────────── main ───────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DEFAULT_DATA, help="dataset dir from build-climb-dataset.py")
    ap.add_argument("--size", type=int, default=None, help="product_size id (default: a 12x12)")
    ap.add_argument("--angle", type=int, default=40)
    ap.add_argument("--grade", type=int, default=20, help="difficulty int (e.g. 20 ≈ V5)")
    ap.add_argument("--nomatch", type=int, choices=[0, 1], default=0, help="1 = no-match climb")
    ap.add_argument("--grade-window", type=int, default=1)
    ap.add_argument("--min-holds", type=int, default=4)
    ap.add_argument("--max-holds", type=int, default=20)
    ap.add_argument("--temperature", type=float, default=0.9)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--out", default="/tmp/generated-climb.png")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    vocab = load_json(os.path.join(args.data, "vocab.json"))
    masks = load_json(os.path.join(args.data, "size_masks.json"))
    geom = load_json(os.path.join(args.data, "geometry.json"))
    names = [n for n in open(os.path.join(args.data, "names.txt")).read().splitlines() if n]

    itos, first_hold = vocab["itos"], vocab["first_hold_id"]
    bos, eos = vocab["stoi"]["BOS"], vocab["stoi"]["EOS"]

    # token -> (placement, role-name) from the vocab + geometry role table.
    role_name = {r["id"]: r["name"] for r in geom["roles"]}
    role_color = {r["id"]: r["color"] for r in geom["roles"]}
    xy = {p["id"]: (p["x"], p["y"]) for p in geom["placements"]}
    placement_of, role_of, color_of = {}, {}, {}
    for tid, tok in enumerate(itos):
        if tid >= first_hold:
            _, p, r = tok.split("_")
            placement_of[tid] = int(p)
            role_of[tid] = role_name.get(int(r), "")
            color_of[tid] = role_color.get(int(r), "888888")

    size_id = args.size if args.size is not None else _default_size(geom)
    if str(size_id) not in masks:
        raise SystemExit(f"size {size_id} not in dataset; options: {sorted(int(k) for k in masks)}")
    allowed = set(masks[str(size_id)]["allowed_token_ids"])
    box = next((s["box"] for s in geom["sizes"] if s["id"] == size_id), None)
    size_name = masks[str(size_id)]["name"]

    rows = list(read_dataset(os.path.join(args.data, "dataset.train.jsonl")))
    grade_label = {r["grade"]: r["grade_label"] for r in rows}

    # Build the bucket, widening the grade window / dropping nomatch if too sparse.
    window, nomatch, note = args.grade_window, args.nomatch, ""
    trans, unigram, n = build_bucket(rows, first_hold, bos, eos, grade=args.grade, window=window, nomatch=nomatch)
    if n < 50:
        window = 3
        trans, unigram, n = build_bucket(rows, first_hold, bos, eos, grade=args.grade, window=window, nomatch=nomatch)
        note = f" (widened grade window to ±{window}"
        if n < 50:  # last resort: ignore the match constraint for the pool
            for v in (0, 1):
                t2, u2, n2 = build_bucket(rows, first_hold, bos, eos, grade=args.grade, window=window, nomatch=v)
                for a, d in t2.items():
                    for b, w in d.items():
                        trans.setdefault(a, {})[b] = trans.setdefault(a, {}).get(b, 0) + w
                for tk, w in u2.items():
                    unigram[tk] = unigram.get(tk, 0) + w
                n += n2
            note += ", pooled match+nomatch"
        note += ")"

    starts = {t: w for t, w in unigram.items() if role_of[t] == "start"}
    finishes = {t: w for t, w in unigram.items() if role_of[t] == "finish"}

    seq = sample_climb(
        rng, trans, unigram, bos=bos, eos=eos, allowed=allowed,
        placement_of=placement_of, role_of=role_of, starts=starts, finishes=finishes,
        min_holds=args.min_holds, max_holds=args.max_holds, temperature=args.temperature,
    )

    # Canonical order (start, body bottom→top, finish) for a tidy frames string + render.
    rank = {"start": 0, "finish": 2}
    seq.sort(key=lambda t: (rank.get(role_of[t], 1), xy[placement_of[t]][1], xy[placement_of[t]][0]))
    frames = "".join(f"p{placement_of[t]}r{int(itos[t].split('_')[2])}" for t in seq)
    holds_xy_color = [(xy[placement_of[t]][0], xy[placement_of[t]][1], color_of[t]) for t in seq]
    grid_xy = [(p["x"], p["y"]) for p in geom["placements"]]

    name = sample_name(rng, name_model(names)) if names else "Untitled"
    counts = {"start": 0, "finish": 0, "foot": 0, "other": 0}
    for t in seq:
        counts[role_of[t] if role_of[t] in counts else "other"] += 1

    out = render(holds_xy_color, grid_xy, box, args.out, name)
    glabel = grade_label.get(args.grade, str(args.grade))
    print(f"Generated climb  «{name}»")
    print(f"  spec: size={size_name!r}  angle={args.angle}°  grade≈{glabel}  {'no-match' if nomatch else 'match'}")
    print(f"  bucket: {n} training climbs{note}")
    print(f"  holds: {len(seq)}  (start={counts['start']} finish={counts['finish']} foot={counts['foot']} hand/other={counts['other']})")
    print(f"  frames: {frames}")
    print(f"  rendered → {out}")


def _default_size(geom) -> int:
    for s in geom["sizes"]:
        if "12 x 12 with kickboard" in s["name"]:
            return s["id"]
    return geom["sizes"][0]["id"]


if __name__ == "__main__":
    main()
