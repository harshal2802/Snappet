#!/usr/bin/env python3
"""Export the trained generator to ONNX + a bundled metadata JSON for in-browser
inference (onnxruntime-web), powering the Board Explorer "Generate" tab.

The graph uses a FIXED sequence length (= block) so it has no dynamic axes — the
most robust form for onnxruntime-web. The client right-pads each step's prefix to
`block` with PAD and reads the logits at the last real position (the causal mask
makes trailing PAD irrelevant to that position, exactly as in training).

    python3 scripts/export_onnx.py

Writes src/frontend/public/climb-generator/{model.onnx, model.q.onnx, meta.json}.
"""
from __future__ import annotations

import json
import os

import numpy as np
import torch

import train_generator as T

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "out", "climb-dataset")
OUT = os.path.join(HERE, "..", "src", "frontend", "public", "climb-generator")


def load(name):
    return json.load(open(os.path.join(DATA, name)))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    vocab, masks, geom = load("vocab.json"), load("size_masks.json"), load("geometry.json")
    gmodel = load("grade_model.json")
    ck = torch.load(os.path.join(DATA, "generator.pt"), map_location="cpu")
    cfg, block = ck["cfg"], ck["block"]
    itos = vocab["itos"]

    model = T.GPT(len(itos), cfg["dim"], cfg["layers"], cfg["heads"], block, dropout=0.0)
    model.load_state_dict(ck["model"])
    model.eval()

    onnx_path = os.path.join(OUT, "model.onnx")
    dummy = torch.zeros(1, block, dtype=torch.long)
    torch.onnx.export(
        model, (dummy,), onnx_path, input_names=["tokens"], output_names=["logits"],
        opset_version=17, dynamo=False,
    )
    print(f"exported {onnx_path}  ({os.path.getsize(onnx_path)/1e6:.1f} MB)")

    # Parity: ONNX must match PyTorch logits on realistic padded prefixes.
    import onnxruntime as ort

    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    stoi = vocab["stoi"]
    rng = np.random.default_rng(0)
    maxdiff = 0.0
    for _ in range(6):
        n = int(rng.integers(6, block))
        seq = [stoi["BOS"], stoi["SIZE_10"], stoi["ANGLE_40"], stoi["GRADE_20"], stoi["MATCH"]]
        seq += [int(rng.integers(vocab["first_hold_id"], len(itos))) for _ in range(n - 5)]
        x = torch.zeros(1, block, dtype=torch.long)
        x[0, : len(seq)] = torch.tensor(seq)
        with torch.no_grad():
            ref = model(x).numpy()
        out = sess.run(None, {"tokens": x.numpy()})[0]
        maxdiff = max(maxdiff, float(np.abs(ref - out).max()))
    assert maxdiff < 2e-3, f"parity failed: max|Δlogit|={maxdiff}"
    print(f"parity OK  (max |Δlogit| = {maxdiff:.2e})")

    # Bundle everything the browser needs (vocab, geometry, masks, grade model).
    grades = sorted(int(t.split("_")[1]) for t in itos if t.startswith("GRADE_"))
    angles = sorted(int(t.split("_")[1]) for t in itos if t.startswith("ANGLE_"))
    meta = {
        "block": block,
        "pad": stoi["PAD"],
        "specials": {k: stoi[k] for k in ("BOS", "EOS", "PAD", "MATCH", "NOMATCH")},
        "firstHoldId": vocab["first_hold_id"],
        "itos": itos,
        "sizes": geom["sizes"],
        "placements": geom["placements"],
        "roles": geom["roles"],
        "sizeMasks": {k: masks[k]["allowed_token_ids"] for k in masks},
        "sizeNames": {k: masks[k]["name"] for k in masks},
        "gradeModel": gmodel,
        "grades": grades,
        "angles": angles,
        "defaultSize": next((s["id"] for s in geom["sizes"] if "12 x 12 with kickboard" in s["name"]),
                            geom["sizes"][0]["id"]),
    }
    meta_path = os.path.join(OUT, "meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print(f"wrote {meta_path}  ({os.path.getsize(meta_path)/1e6:.2f} MB)")

    # Dynamic int8 quantization → ~4x smaller download, negligible effect under
    # constrained decoding + re-ranking.
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType

        q_path = os.path.join(OUT, "model.q.onnx")
        quantize_dynamic(onnx_path, q_path, weight_type=QuantType.QInt8)
        qs = ort.InferenceSession(q_path, providers=["CPUExecutionProvider"])
        x = torch.zeros(1, block, dtype=torch.long)
        x[0, :5] = torch.tensor([stoi["BOS"], stoi["SIZE_10"], stoi["ANGLE_40"], stoi["GRADE_20"], stoi["MATCH"]])
        with torch.no_grad():
            ref = model(x).numpy()[0, 4]
        q = qs.run(None, {"tokens": x.numpy()})[0][0, 4]
        # rank correlation of the first-hold logits is what matters for sampling
        order_ref, order_q = np.argsort(-ref)[:20], np.argsort(-q)[:20]
        overlap = len(set(order_ref) & set(order_q)) / 20
        print(f"quantized {q_path}  ({os.path.getsize(q_path)/1e6:.1f} MB)  "
              f"top-20 logit overlap={overlap:.0%}")
    except Exception as e:  # noqa: BLE001
        print(f"quantization skipped: {e}")


if __name__ == "__main__":
    main()
