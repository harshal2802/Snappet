#!/usr/bin/env python3
"""Baseline grade predictor for generated/real climbs (research scaffold, stdlib-only).

The research plan (`pdd/context/research/kilter-climb-generator.md`) says to build the
grade predictor FIRST: it validates the data→label pipeline on an easy supervised
task, and it becomes the **re-ranker** for the generator (sample N climbs, keep the
ones whose predicted grade matches the request). A trained CNN/GNN on a GPU will beat
this, but a linear model over the holds is a legitimate, verifiable floor — and it
runs in seconds with no third-party deps.

Model: ridge (L2) linear regression by sparse SGD. Features per (climb, angle):
a multi-hot over the (placement, role) hold tokens + one-hot wall angle + the
match/no-match flag + bias. Target: display grade. Crucially it takes `is_nomatch`
as a feature, since no-match climbs are graded ~2 V harder for the same holds — the
learned weight should come out positive.

Trains on dataset.train.jsonl, reports MAE on val/test (split by climb uuid, so no
leakage), saves `grade_model.json`, and can score a single climb.

Usage:
    python3 scripts/build-climb-dataset.py --min-ascents 5      # produce the dataset
    python3 scripts/train_grade_predictor.py                    # train + evaluate + save
    python3 scripts/train_grade_predictor.py --score "p1131r12p1386r14…" --angle 40 --nomatch 0
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA = os.path.join(HERE, "out", "climb-dataset")
V_RE = re.compile(r"V(\d+)")


def load_rows(path: str) -> list[dict]:
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def featurize(rows, first_hold, angle_index):
    """Each example -> (hold_token_ids, angle_idx, nomatch, grade)."""
    out = []
    for r in rows:
        holds = [t for t in r["tokens"] if t >= first_hold]
        ai = angle_index.get(r["angle"])
        if ai is None or not holds:
            continue
        out.append((holds, ai, int(r["nomatch"]), float(r["grade"])))
    return out


def train(train_ex, n_vocab, n_angles, *, lr, l2, epochs, val_ex, y_mean, rng):
    w_hold = [0.0] * n_vocab
    w_angle = [0.0] * n_angles
    w_nomatch = 0.0
    bias = 0.0

    def predict(holds, ai, nm):
        s = bias + w_angle[ai] + w_nomatch * nm
        for h in holds:
            s += w_hold[h]
        return s

    for ep in range(epochs):
        rng.shuffle(train_ex)
        cur_lr = lr / (1 + 0.3 * ep)  # gentle decay
        for holds, ai, nm, y in train_ex:
            err = predict(holds, ai, nm) - (y - y_mean)
            bias -= cur_lr * err
            w_angle[ai] -= cur_lr * (err + l2 * w_angle[ai])
            if nm:
                w_nomatch -= cur_lr * (err + l2 * w_nomatch)
            for h in holds:
                w_hold[h] -= cur_lr * (err + l2 * w_hold[h])
        mae = sum(abs(predict(h, a, n) + y_mean - y) for h, a, n, y in val_ex) / len(val_ex)
        print(f"  epoch {ep + 1:>2}/{epochs}  val MAE(grade)={mae:.3f}  lr={cur_lr:.4f}")
    return {"w_hold": w_hold, "w_angle": w_angle, "w_nomatch": w_nomatch, "bias": bias}


def predict_one(model, holds, ai, nm, y_mean):
    s = model["bias"] + model["w_angle"][ai] + model["w_nomatch"] * nm
    for h in holds:
        s += model["w_hold"][h]
    return s + y_mean


def evaluate(model, ex, y_mean, grade_to_v):
    n = len(ex)
    abs_g = abs_v = within1v = 0.0
    by_nm = {0: [0.0, 0], 1: [0.0, 0]}
    for holds, ai, nm, y in ex:
        pred = predict_one(model, holds, ai, nm, y_mean)
        abs_g += abs(pred - y)
        pv, yv = grade_to_v(round(pred)), grade_to_v(y)
        abs_v += abs(pv - yv)
        within1v += 1 if abs(pv - yv) <= 1 else 0
        by_nm[nm][0] += abs(pred - y)
        by_nm[nm][1] += 1
    return {
        "mae_grade": abs_g / n,
        "mae_v": abs_v / n,
        "within_1_v": within1v / n,
        "mae_grade_match": by_nm[0][0] / max(by_nm[0][1], 1),
        "mae_grade_nomatch": by_nm[1][0] / max(by_nm[1][1], 1),
    }


def build_grade_to_v(rows):
    """Map difficulty int -> V number, learned from the dataset's grade_label."""
    m: dict[int, int] = {}
    for r in rows:
        mt = V_RE.search(r.get("grade_label", ""))
        if mt:
            m[r["grade"]] = int(mt.group(1))
    keys = sorted(m)

    def to_v(g: int) -> float:
        if g in m:
            return m[g]
        if not keys:
            return g
        k = min(keys, key=lambda k: abs(k - g))  # nearest known difficulty
        return m[k]

    return to_v


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DEFAULT_DATA)
    ap.add_argument("--lr", type=float, default=0.04)
    ap.add_argument("--l2", type=float, default=1e-5)
    ap.add_argument("--epochs", type=int, default=14)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--score", default=None, help="a frames string to grade (with --angle/--nomatch)")
    ap.add_argument("--angle", type=int, default=40)
    ap.add_argument("--nomatch", type=int, choices=[0, 1], default=0)
    args = ap.parse_args()

    vocab = json.load(open(os.path.join(args.data, "vocab.json")))
    first_hold = vocab["first_hold_id"]
    n_vocab = len(vocab["itos"])

    # --score: load a saved model and grade one climb.
    if args.score is not None:
        model = json.load(open(os.path.join(args.data, "grade_model.json")))
        ai = model["angle_index"].get(str(args.angle))
        if ai is None:
            raise SystemExit(f"angle {args.angle} not seen in training; options {sorted(int(a) for a in model['angle_index'])}")
        holds = [vocab["stoi"][f"HOLD_{p}_{r}"] for p, r in re.findall(r"p(\d+)r(\d+)", args.score)
                 if f"HOLD_{p}_{r}" in vocab["stoi"]]
        pred = predict_one(model, holds, ai, args.nomatch, model["y_mean"])
        to_v = build_grade_to_v(load_rows(os.path.join(args.data, "dataset.train.jsonl")))
        print(f"predicted grade ≈ {pred:.1f} (≈ V{to_v(round(pred))})  [{'no-match' if args.nomatch else 'match'}, {args.angle}°, {len(holds)} holds]")
        return

    rng = random.Random(args.seed)
    train_rows = load_rows(os.path.join(args.data, "dataset.train.jsonl"))
    val_rows = load_rows(os.path.join(args.data, "dataset.val.jsonl"))
    test_rows = load_rows(os.path.join(args.data, "dataset.test.jsonl"))

    angles = sorted({r["angle"] for r in train_rows})
    angle_index = {a: i for i, a in enumerate(angles)}
    grade_to_v = build_grade_to_v(train_rows + val_rows + test_rows)

    tr = featurize(train_rows, first_hold, angle_index)
    va = featurize(val_rows, first_hold, angle_index)
    te = featurize(test_rows, first_hold, angle_index)
    y_mean = sum(y for *_, y in tr) / len(tr)

    naive = sum(abs(y - y_mean) for *_, y in te) / len(te)
    print(f"train={len(tr)} val={len(va)} test={len(te)}  mean grade={y_mean:.2f}")
    print(f"naive baseline (predict mean) test MAE(grade)={naive:.3f}\ntraining:")
    model = train(tr, n_vocab, len(angles), lr=args.lr, l2=args.l2, epochs=args.epochs,
                  val_ex=va, y_mean=y_mean, rng=rng)

    res = evaluate(model, te, y_mean, grade_to_v)
    print("\ntest set:")
    print(f"  MAE = {res['mae_grade']:.3f} grade-units  ≈ {res['mae_v']:.2f} V-grades")
    print(f"  within 1 V-grade: {100 * res['within_1_v']:.1f}%")
    print(f"  MAE by rule: match={res['mae_grade_match']:.3f}  no-match={res['mae_grade_nomatch']:.3f}")
    print(f"  learned no-match weight = {model['w_nomatch']:+.3f} grade-units (expected > 0: no-match is harder)")

    out = {**model, "angle_index": {str(a): i for a, i in angle_index.items()}, "y_mean": y_mean,
           "first_hold_id": first_hold}
    with open(os.path.join(args.data, "grade_model.json"), "w") as f:
        json.dump(out, f)
    print(f"\nsaved {args.data}/grade_model.json  (use --score to grade a climb)")


if __name__ == "__main__":
    main()
