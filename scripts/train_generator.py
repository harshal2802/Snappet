#!/usr/bin/env python3
"""Train the conditional climb generator — a small autoregressive transformer over
the tokenized sequences from `build-climb-dataset.py` (research scaffold).

This is the real model the CPU baseline (`climb_baseline.py`) stands in for. Each
training example is a sequence

    [BOS] [SIZE] [ANGLE] [GRADE] [MATCH/NOMATCH]  HOLD … HOLD  [EOS]

and the model learns next-token prediction over the holds + EOS (the conditioner
prefix is given, not predicted, so it's a *conditional* LM). Sampling feeds the
prefix and decodes holds under hard constraints — the per-size hold mask (so the
climb fits the board), no duplicate placement, and ≥1 start + ≥1 finish — so every
sample is valid regardless of how well-trained the net is.

It is small on purpose (a few M params) so it trains on a single GPU in minutes and
later exports to ONNX to run in the browser. Auto-detects CUDA; runs on CPU too (the
`--smoke` preset trains a tiny net briefly just to prove the loop end-to-end).

Usage (GPU, e.g. Colab — see scripts/train_generator_colab.ipynb):
    python3 scripts/build-climb-dataset.py --min-ascents 5
    python3 scripts/train_generator.py --epochs 12 --dim 256 --layers 6 --heads 8
    python3 scripts/train_generator.py --sample --size 10 --angle 40 --grade 20 --nomatch 0

Smoke test (CPU, fast, underfit — just verifies the code path):
    python3 scripts/train_generator.py --smoke
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re

import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA = os.path.join(HERE, "out", "climb-dataset")
N_COND = 4  # SIZE, ANGLE, GRADE, MATCH — given (loss is not taken on these)
IGNORE = -100


# ─────────────────────────────────── model ───────────────────────────────────

class Block(nn.Module):
    def __init__(self, dim: int, heads: int, block: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(dim)
        self.attn = nn.MultiheadAttention(dim, heads, batch_first=True)
        self.ln2 = nn.LayerNorm(dim)
        self.mlp = nn.Sequential(nn.Linear(dim, 4 * dim), nn.GELU(), nn.Linear(4 * dim, dim))
        self.register_buffer("mask", torch.triu(torch.ones(block, block) * float("-inf"), diagonal=1))

    def forward(self, x):
        t = x.size(1)
        h = self.ln1(x)
        a, _ = self.attn(h, h, h, attn_mask=self.mask[:t, :t], need_weights=False)
        x = x + a
        return x + self.mlp(self.ln2(x))


class GPT(nn.Module):
    def __init__(self, vocab: int, dim: int, layers: int, heads: int, block: int):
        super().__init__()
        self.block = block
        self.tok = nn.Embedding(vocab, dim)
        self.pos = nn.Embedding(block, dim)
        self.blocks = nn.ModuleList([Block(dim, heads, block) for _ in range(layers)])
        self.lnf = nn.LayerNorm(dim)
        self.head = nn.Linear(dim, vocab, bias=False)
        self.head.weight = self.tok.weight  # tie
        self.apply(self._init_weights)

    @staticmethod
    def _init_weights(m):
        if isinstance(m, nn.Linear):
            nn.init.normal_(m.weight, std=0.02)
            if m.bias is not None:
                nn.init.zeros_(m.bias)
        elif isinstance(m, nn.Embedding):
            nn.init.normal_(m.weight, std=0.02)

    def forward(self, idx):
        pos = torch.arange(idx.size(1), device=idx.device)
        x = self.tok(idx) + self.pos(pos)[None]
        for b in self.blocks:
            x = b(x)
        return self.head(self.lnf(x))


# ──────────────────────────────────── data ───────────────────────────────────

def load_seqs(path: str, limit: int | None = None) -> list[list[int]]:
    out = []
    with open(path) as f:
        for line in f:
            if line.strip():
                out.append(json.loads(line)["tokens"])
                if limit and len(out) >= limit:
                    break
    return out


def make_batch(seqs, idxs, block, pad, device):
    x = torch.full((len(idxs), block), pad, dtype=torch.long)
    y = torch.full((len(idxs), block), IGNORE, dtype=torch.long)
    for r, i in enumerate(idxs):
        s = seqs[i][:block + 1]
        inp = s[:-1]
        x[r, : len(inp)] = torch.tensor(inp)
        tgt = s[1:]
        y[r, : len(tgt)] = torch.tensor(tgt)
        y[r, : N_COND] = IGNORE  # don't take loss on the given conditioners
    return x.to(device), y.to(device)


@torch.no_grad()
def eval_loss(model, seqs, block, pad, device, bs=128):
    model.eval()
    tot = n = 0
    for i in range(0, len(seqs), bs):
        x, y = make_batch(seqs, range(i, min(i + bs, len(seqs))), block, pad, device)
        logits = model(x)
        loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1), ignore_index=IGNORE)
        tot += loss.item() * x.size(0)
        n += x.size(0)
    return tot / max(n, 1)


# ───────────────────────────── constrained sampling ──────────────────────────

def hold_meta(vocab):
    """token id -> (placement, role-id) for every HOLD token."""
    placement, role = {}, {}
    for tid, tok in enumerate(vocab["itos"]):
        if tok.startswith("HOLD_"):
            _, p, r = tok.split("_")
            placement[tid] = int(p)
            role[tid] = int(r)
    return placement, role


@torch.no_grad()
def generate(model, vocab, masks, geom, *, size, angle, grade, nomatch, device,
             temperature=0.9, max_holds=20, min_holds=4):
    stoi = vocab["stoi"]
    eos = stoi["EOS"]
    placement, role = hold_meta(vocab)
    role_name = {r["id"]: r["name"] for r in geom["roles"]}
    allowed = set(masks[str(size)]["allowed_token_ids"])
    match_tok = stoi["NOMATCH"] if nomatch else stoi["MATCH"]
    seq = [stoi["BOS"], stoi[f"SIZE_{size}"], stoi[f"ANGLE_{angle}"], stoi[f"GRADE_{grade}"], match_tok]
    used, holds = set(), []
    have_start = have_finish = False
    model.eval()
    for _ in range(max_holds):
        x = torch.tensor([seq[-model.block:]], device=device)
        logits = model(x)[0, -1] / temperature
        eligible = have_start and have_finish and len(holds) >= min_holds
        mask = torch.full_like(logits, float("-inf"))
        for t in allowed:
            if t == eos:
                if eligible:
                    mask[t] = logits[t]
            elif placement[t] not in used:
                mask[t] = logits[t]
        probs = F.softmax(mask, dim=-1)
        nxt = int(torch.multinomial(probs, 1))
        if nxt == eos:
            break
        seq.append(nxt)
        holds.append(nxt)
        used.add(placement[nxt])
        have_start = have_start or role_name.get(role[nxt]) == "start"
        have_finish = have_finish or role_name.get(role[nxt]) == "finish"
    # Guarantee validity even from an untrained net.
    for need, want in (("start", not have_start), ("finish", not have_finish)):
        if want:
            for t in sorted(allowed):
                if t != eos and placement[t] not in used and role_name.get(role[t]) == need:
                    holds.append(t)
                    used.add(placement[t])
                    break
    return holds, placement, role


# ──────────────────────────────────── main ───────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DEFAULT_DATA)
    ap.add_argument("--dim", type=int, default=256)
    ap.add_argument("--layers", type=int, default=6)
    ap.add_argument("--heads", type=int, default=8)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--limit-train", type=int, default=None, help="cap train examples (debug)")
    ap.add_argument("--max-steps", type=int, default=None, help="cap optimiser steps (debug)")
    ap.add_argument("--patience", type=int, default=3, help="early-stop after N epochs w/o val improvement")
    ap.add_argument("--ckpt", default=os.path.join(DEFAULT_DATA, "generator.pt"))
    ap.add_argument("--smoke", action="store_true", help="tiny net, few steps, CPU — just prove the loop")
    ap.add_argument("--sample", action="store_true", help="load --ckpt and generate instead of training")
    ap.add_argument("--size", type=int, default=10)
    ap.add_argument("--angle", type=int, default=40)
    ap.add_argument("--grade", type=int, default=20)
    ap.add_argument("--nomatch", type=int, choices=[0, 1], default=0)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    if args.smoke:
        args.dim, args.layers, args.heads, args.epochs, args.batch = 96, 2, 4, 4, 128
        args.limit_train = args.limit_train or 4000
        args.max_steps = args.max_steps or 90
    torch.manual_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    vocab = json.load(open(os.path.join(args.data, "vocab.json")))
    masks = json.load(open(os.path.join(args.data, "size_masks.json")))
    geom = json.load(open(os.path.join(args.data, "geometry.json")))
    pad = vocab["stoi"]["PAD"]

    if args.sample:  # self-contained: size the net from the checkpoint, no dataset needed
        ck = torch.load(args.ckpt, map_location=device)
        cfg = ck.get("cfg", {"dim": args.dim, "layers": args.layers, "heads": args.heads})
        model = GPT(len(vocab["itos"]), cfg["dim"], cfg["layers"], cfg["heads"], ck["block"]).to(device)
        model.load_state_dict(ck["model"])
        holds, placement, role = generate(model, vocab, masks, geom, size=args.size, angle=args.angle,
                                           grade=args.grade, nomatch=args.nomatch, device=device)
        frames = "".join(f"p{placement[t]}r{role[t]}" for t in holds)
        print(f"generated {len(holds)} holds  frames: {frames}")
        return

    train = load_seqs(os.path.join(args.data, "dataset.train.jsonl"), args.limit_train)
    block = min(72, max(len(s) for s in train))
    val = load_seqs(os.path.join(args.data, "dataset.val.jsonl"), (args.limit_train or 0) // 8 or None)
    model = GPT(len(vocab["itos"]), args.dim, args.layers, args.heads, block).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"device={device}  block={block}  params={n_params/1e6:.2f}M  train={len(train)} val={len(val)}")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    g = torch.Generator().manual_seed(args.seed)
    ckpt = {"block": block, "cfg": {"dim": args.dim, "layers": args.layers, "heads": args.heads}}
    step, best_val, bad = 0, float("inf"), 0
    for ep in range(args.epochs):
        model.train()
        order = torch.randperm(len(train), generator=g).tolist()
        for i in range(0, len(train), args.batch):
            x, y = make_batch(train, order[i : i + args.batch], block, pad, device)
            logits = model(x)
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1), ignore_index=IGNORE)
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            step += 1
            if step % 10 == 0:
                print(f"  ep{ep+1} step{step} train_loss={loss.item():.3f}")
            if args.max_steps and step >= args.max_steps:
                break
        vl = eval_loss(model, val, block, pad, device)
        if vl < best_val - 1e-4:
            best_val, bad = vl, 0
            ckpt["model"] = model.state_dict()
            torch.save(ckpt, args.ckpt)
            tag = "  ← best, saved"
        else:
            bad += 1
            tag = f"  (no improve {bad}/{args.patience})"
        print(f"epoch {ep+1}: val_loss={vl:.3f}  ppl={math.exp(vl):.1f}{tag}", flush=True)
        if args.max_steps and step >= args.max_steps:
            break
        if bad >= args.patience:
            print(f"early stop: val plateaued after {ep+1} epochs (best ppl={math.exp(best_val):.1f})")
            break

    print(f"saved {args.ckpt}  (best val_loss={best_val:.3f}, ppl={math.exp(best_val):.1f})")
    if "model" in ckpt:  # sample from the best checkpoint, not the last epoch
        model.load_state_dict(ckpt["model"])

    holds, placement, role = generate(model, vocab, masks, geom, size=args.size, angle=args.angle,
                                      grade=args.grade, nomatch=args.nomatch, device=device)
    frames = "".join(f"p{placement[t]}r{role[t]}" for t in holds)
    print(f"\nsample ({len(holds)} holds, size={args.size} {args.angle}° grade≈{args.grade} "
          f"{'no-match' if args.nomatch else 'match'}):\n  {frames}")


if __name__ == "__main__":
    main()
