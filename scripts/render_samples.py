#!/usr/bin/env python3
"""Render a contact sheet of climbs from the trained generator checkpoint.

Loads `generator.pt` (from train_generator.py), samples a small matrix of
conditions — match / no-match × easy / medium / hard — at a 12x12 board, and
composites them into one labelled PNG, reusing the baseline's board renderer.
Run it after training has produced a checkpoint.

    python3 scripts/render_samples.py
    python3 scripts/render_samples.py --angle 45 --grades 8 15 22
"""
from __future__ import annotations

import argparse
import json
import os

import torch

import train_generator as T
from climb_baseline import _default_size, render

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "out", "climb-dataset")


def load(name):
    return json.load(open(os.path.join(DATA, name)))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ckpt", default=os.path.join(DATA, "generator.pt"))
    ap.add_argument("--angle", type=int, default=40)
    ap.add_argument("--grades", type=int, nargs="+", default=[10, 17, 24], help="easy → hard")
    ap.add_argument("--temperature", type=float, default=0.9)
    ap.add_argument("--rerank", type=int, default=12, help="sample N per tile; grade model picks the closest")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=os.path.join(DATA, "samples.png"))
    args = ap.parse_args()
    torch.manual_seed(args.seed)
    device = "cpu"

    vocab, masks, geom = load("vocab.json"), load("size_masks.json"), load("geometry.json")
    gm_path = os.path.join(DATA, "grade_model.json")
    gmodel = load("grade_model.json") if os.path.exists(gm_path) else None
    ck = torch.load(args.ckpt, map_location=device)
    cfg = ck["cfg"]
    model = T.GPT(len(vocab["itos"]), cfg["dim"], cfg["layers"], cfg["heads"], ck["block"]).to(device)
    model.load_state_dict(ck["model"])
    model.eval()

    size = _default_size(geom)
    xy = {p["id"]: (p["x"], p["y"]) for p in geom["placements"]}
    role_color = {r["id"]: r["color"] for r in geom["roles"]}
    role_name = {r["id"]: r["name"] for r in geom["roles"]}
    grid_xy = [(p["x"], p["y"]) for p in geom["placements"]]
    box = next((s["box"] for s in geom["sizes"] if s["id"] == size), None)
    rank = {"start": 0, "finish": 2}  # draw starts low, finishes high

    tiles = []
    for nomatch in (0, 1):
        for grade in args.grades:
            holds, placement, role, pg = T.generate_reranked(
                model, vocab, masks, geom, gmodel, size=size, angle=args.angle, grade=grade,
                nomatch=nomatch, device=device, n=args.rerank, temperature=args.temperature)
            holds.sort(key=lambda t: (rank.get(role_name.get(role[t], ""), 1),
                                      xy[placement[t]][1], xy[placement[t]][0]))
            hxc = [(xy[placement[t]][0], xy[placement[t]][1], role_color.get(role[t], "888888"))
                   for t in holds if placement[t] in xy]
            tmp = os.path.join("/tmp", f"sample_{nomatch}_{grade}.png")
            out = render(hxc, grid_xy, box, tmp, "")
            pred = f"  pred~{pg:.1f}" if gmodel is not None else ""
            label = f"target grade~{grade}{pred}  {'no-match' if nomatch else 'match'}  ({len(holds)} holds)"
            tiles.append((out, label))
            print(f"  {label} -> {out}")

    if any(p.endswith(".svg") for p, _ in tiles):
        print("Pillow unavailable — wrote per-tile SVGs; skipping contact sheet.")
        return

    from PIL import Image, ImageDraw
    imgs = [Image.open(p) for p, _ in tiles]
    tw, th = imgs[0].size
    cols, bar = len(args.grades), 22
    sheet = Image.new("RGB", (cols * tw, 2 * (th + bar)), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (img, (_, label)) in enumerate(zip(imgs, tiles)):
        x, y = (i % cols) * tw, (i // cols) * (th + bar)
        d.text((x + 6, y + 6), label, fill=(20, 20, 20))
        sheet.paste(img, (x, y + bar))
    sheet.save(args.out)
    print(f"contact sheet -> {args.out}  ({sheet.size[0]}x{sheet.size[1]})")


if __name__ == "__main__":
    main()
