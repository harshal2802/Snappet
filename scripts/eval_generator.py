#!/usr/bin/env python3
"""Quantitative evaluation of the trained climb generator.

Generates many climbs across a grade x match/no-match grid and measures the things
that decide whether it is good enough to put in front of users:

  validity     fraction satisfying all hard constraints (size mask, no-dup, >=1
               start, >=1 finish) — should be ~100% by construction.
  grade MAE    |grade_model(climb) - target| (predictor-estimated, not human),
               reported with and without grade re-ranking to show the lever.
  within 1     fraction within one V-grade of target.
  diversity    mean pairwise Jaccard distance between climbs for the same prompt
               (1 = all different, 0 = identical), plus the distinct rate.
  novelty      fraction that are NOT exact copies of a training climb, and mean
               nearest-Jaccard distance to the (same-size) training set.

    python3 scripts/eval_generator.py                 # full eval (run after training)
    python3 scripts/eval_generator.py --quick         # tiny, for a fast sanity check
"""
from __future__ import annotations

import argparse
import json
import os
import random

import torch

import train_generator as T

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "out", "climb-dataset")


def load(name):
    return json.load(open(os.path.join(DATA, name)))


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if (a or b) else 1.0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ckpt", default=os.path.join(DATA, "generator.pt"))
    ap.add_argument("--size", type=int, default=10)
    ap.add_argument("--angle", type=int, default=40)
    ap.add_argument("--grades", type=int, nargs="+", default=[10, 13, 16, 19, 22, 25])
    ap.add_argument("--samples", type=int, default=12, help="climbs per (grade,match) condition")
    ap.add_argument("--rerank", type=int, default=12, help="candidates per climb for the reranked pass")
    ap.add_argument("--temperature", type=float, default=0.9)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--quick", action="store_true", help="tiny settings for a fast correctness check")
    args = ap.parse_args()
    if args.quick:
        args.grades, args.samples, args.rerank = [12, 22], 3, 4
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    device = "cpu"

    vocab, masks, geom = load("vocab.json"), load("size_masks.json"), load("geometry.json")
    gmodel = load("grade_model.json")
    ck = torch.load(args.ckpt, map_location=device)
    cfg = ck["cfg"]
    model = T.GPT(len(vocab["itos"]), cfg["dim"], cfg["layers"], cfg["heads"], ck["block"]).to(device)
    model.load_state_dict(ck["model"])
    model.eval()

    placement, role = T.hold_meta(vocab)
    role_name = {r["id"]: r["name"] for r in geom["roles"]}
    eos = vocab["stoi"]["EOS"]
    allowed = {t for t in masks[str(args.size)]["allowed_token_ids"] if t != eos}
    first_hold = vocab["first_hold_id"]
    size_tok = vocab["stoi"][f"SIZE_{args.size}"]

    # Training climbs of this size, as hold-sets, for the novelty check.
    train_sets = []
    with open(os.path.join(DATA, "dataset.train.jsonl")) as f:
        for line in f:
            if not line.strip():
                continue
            toks = json.loads(line)["tokens"]
            if toks[1] == size_tok:
                train_sets.append(frozenset(t for t in toks if t >= first_hold))
    train_exact = set(train_sets)
    novelty_pool = random.sample(train_sets, min(4000, len(train_sets)))
    print(f"size={args.size} angle={args.angle}  train climbs (this size)={len(train_sets)}  "
          f"samples/cond={args.samples}  rerank N={args.rerank}\n")

    def valid(holds):
        ps = [placement[t] for t in holds]
        roles = {role_name.get(role[t]) for t in holds}
        return bool(holds) and len(set(ps)) == len(ps) and all(t in allowed for t in holds) \
            and "start" in roles and "finish" in roles

    def evaluate(rerank_n):
        rows, mae, within1, valids, novel, near, holdcount, per_grade = [], [], [], [], [], [], [], {}
        for nomatch in (0, 1):
            for grade in args.grades:
                cond = []
                for _ in range(args.samples):
                    holds, _pl, _ro, pg = T.generate_reranked(
                        model, vocab, masks, geom, gmodel, size=args.size, angle=args.angle,
                        grade=grade, nomatch=nomatch, device=device, n=rerank_n, temperature=args.temperature)
                    hs = frozenset(holds)
                    cond.append(hs)
                    mae.append(abs(pg - grade))
                    within1.append(abs(pg - grade) <= 1.0)
                    valids.append(valid(holds))
                    novel.append(hs not in train_exact)
                    near.append(1.0 - max((jaccard(set(hs), set(t)) for t in novelty_pool), default=0.0))
                    holdcount.append(len(holds))
                    per_grade.setdefault(grade, []).append(abs(pg - grade))
                # diversity within this condition
                pairs = [1 - jaccard(set(a), set(b)) for i, a in enumerate(cond) for b in cond[i + 1:]]
                rows.append((sum(pairs) / len(pairs) if pairs else 0.0, len(set(cond)) / len(cond)))
        pct = lambda xs: 100 * sum(xs) / len(xs)
        return {
            "mae": sum(mae) / len(mae), "within1": pct(within1), "validity": pct(valids),
            "diversity": sum(r[0] for r in rows) / len(rows), "distinct": 100 * sum(r[1] for r in rows) / len(rows),
            "novel": pct(novel), "near": sum(near) / len(near), "holds": sum(holdcount) / len(holdcount),
            "per_grade": {g: sum(v) / len(v) for g, v in per_grade.items()},
        }

    print("running no-rerank pass ...", flush=True)
    base = evaluate(1)
    print("running reranked pass ...", flush=True)
    rr = evaluate(args.rerank)

    def row(name, key, fmt="{:.2f}"):
        print(f"  {name:<22}{fmt.format(base[key]):>10}{fmt.format(rr[key]):>12}")

    print(f"\n=== Generator eval — size {args.size}, angle {args.angle} ===")
    print(f"  {'metric':<22}{'no-rerank':>10}{'rerank':>12}")
    row("grade MAE", "mae")
    row("within 1 grade %", "within1")
    row("validity %", "validity")
    row("diversity (pairwise)", "diversity")
    row("distinct rate %", "distinct")
    row("novel (not a copy) %", "novel")
    row("nearest-Jaccard dist", "near")
    row("mean holds", "holds")
    print("\n  grade MAE by target (reranked):")
    for g in args.grades:
        print(f"    target {g:>3}:  {rr['per_grade'][g]:.2f}")


if __name__ == "__main__":
    main()
