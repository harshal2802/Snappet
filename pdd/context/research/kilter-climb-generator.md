# Research: Conditional climb generator for Kilter / Aurora board data

**Date**: 2026-06-07
**Outcome**: **Feasible — recommend a spike.** The bundled Board Explorer snapshots already contain
enough data and the right shape to train a **conditional generative model** that, given
**(board size, angle, target grade)**, emits a **new, valid climb** (a set of holds) that physically
fits the requested board. The model is small enough to train offline and run **100% client-side**,
matching Snappet's no-backend rule. A maintainer-only data-prep + tokenizer scaffold ships with this
research at [`scripts/build-climb-dataset.py`](../../../scripts/build-climb-dataset.py); the modelling
itself is not yet built. **Board size is treated as a first-class input** (a conditioning token *and* a
hard decode-time hold mask), not an afterthought.

---

## Question

Can we train a generative model to invent new Kilter climbs from a user's spec — specifically a
**board size**, a **wall angle**, and a **target grade** — and surface it inside the Snappet
Board Explorer? Do we have enough data, what does the model look like, and how would it integrate?

## What a "climb" is in this data (the modelling object)

From the bundled snapshot (`src/frontend/public/board-data/kilter.sqlite.gz`), a climb's holds live in
`climbs.frames` as tokens `p<placement_id>r<role_id>` (split on `p`). Each token is one hold:

- **`placement_id` → `placements.hole_id` → `holes.x, holes.y`** — a fixed position on the wall.
- **`role_id` → `placement_roles`** — one of **start** (green), **middle/any** (blue),
  **finish** (red), **foot** (magenta). Colours are literally in the table.

So a climb is **an unordered set of `(x, y, role)` holds on a fixed grid** — a clean, bounded
combinatorial object. That is the entire ML problem.

## Board size is a first-class axis (the part the first design under-served)

A board **size** is a rectangle `(edge_left, edge_right, edge_bottom, edge_top)` in the *same units as
`holes.x/y`*. Every **climb also carries its own bounding box** (`climbs.edge_*`). A climb fits a size
iff its bbox ⊆ the size's box — exactly how Aurora's "explore → size" filter works. Crucially, **size
changes which holds physically exist**, shrinking both the vocabulary and the eligible training set.

Kilter Original (product 1, layout 1), measured from the live snapshot:

| Size | Box (L,R,B,T) | Holds present | Climbs that fit |
|---|---|---:|---:|
| 7×10 (Small) | 28,116,36,156 | **243** / 692 | 8,743 |
| 8×12 (Home) | 24,120,0,156 | 349 | 79,700 |
| 12×12 w/ kickboard | 0,144,0,156 | 514 | 221,009 |
| 12×14 (Commercial) | 0,144,0,180 | 565 | 221,108 |
| 16×12 (Super Wide) | −24,168,0,156 | **641** | 227,605 |

Sizes are **nested subsets** — a 7×10 is a crop of the 12×12 — so a climb set on the big board often
uses holds that don't exist on a small one. **You cannot "generate big and crop."** Size is a hard
constraint on the hold vocabulary. (Note: size is scoped *within a product*: Kilter also has the
**Homewall** family — product 7 / layout 8 — with its own sizes. LED-kit variants that share a box
are de-duped.)

## Do we have enough data? — Yes

Kilter, listed single-frame climbs, **layout 1** (one example per climb × angle):

| Training set | Examples |
|---|---|
| Distinct climbs | 227,704 |
| (climb × angle) — natural conditioning examples | 286,326 |
| …with ≥ 5 ascents (crowd-validated, "clean") | **66,536** |
| …with ≥ 10 ascents | 37,501 |
| …with ≥ 20 ascents | 23,357 |

Grades form a healthy bell curve centred on V4–V7 (`difficulty_grades` maps difficulty int 10–32 →
V0–V15); angles span 0–70° in 5° steps. The vocabulary is ~690 positions and the median climb is **12
holds** (p90 = 18) — tiny next to language modelling. **Hundreds of thousands of examples is
abundant.** This is also well-trodden ground: community projects train Kilter route generators and
grade predictors on exactly this boardlib data.

The real constraint is not quantity but **per-size data poverty + label noise**. The crowd-validated
set collapses from ~221k (12×12) to ~3.9k (7×10) once split by min-fit size, and crowd grades/quality
are soft and angle-dependent. Mitigations below.

## Representation & model

Two interchangeable representations:

- **Sequence/token** (for a GPT-style model): climb = ordered list of `(placement, role)` tokens.
  Observed vocab ≈ 2,100 hold tokens + specials. Median length 12 → trivial context window.
- **Grid/multi-hot** (for VAE/diffusion/CNN): climb = a `47 × 38 × 5` tensor (5 = none/start/middle/
  finish/foot). Fixed size; good for *inpainting* (user pins a few holds, model completes).

### Recommended primary: conditional autoregressive Transformer (small GPT)

```
[BOS] [SIZE=8x12] [ANGLE=40] [GRADE=V5]   H..  H..  ..   [EOS]
```

- **Canonical ordering** (the key trick): starts first, body bottom→top (y asc, x asc), finish last.
  A deterministic target order turns an unordered set into a well-posed next-token problem. (The
  scaffold's `canonical_order` implements this.)
- **Size handled two ways, use both:**
  1. **Conditioning token** `[SIZE=…]` so the model learns size-appropriate *style* (small boards
     climb denser/more compressed — not just "fewer holds").
  2. **Decode-time geometric mask** — restrict the generable hold tokens to those whose placement sits
     in the requested size's box (`size_masks.json`). Guarantees every output **physically fits**, for
     free. Same hook also forces ≥1 start + ≥1 finish and forbids duplicate placements.
- **Size training label** = each climb's **minimum-fit size** (smallest standard box containing its
  bbox) — the setter's effective board.
- **Size:** ~4–8 layers, d≈256, **5–15M params** — minutes–hours on one Colab/Kaggle GPU; exports to
  ONNX / transformers.js to run in-browser.
- **Classifier-free guidance:** drop each conditioner ~10% of the time so controllability is tunable
  at sampling.

**Why one model, not per-size models:** the 7×10 set (~3.9k) is too small to train alone. A single
size-conditioned model lets the 12×12-dominated majority teach general structure while the SIZE token +
mask specialise it. Where data is thin, the mask still guarantees validity — worst case the *style* is
generic, never unplayable.

### Companion to build *first*: a grade + quality predictor

A small CNN over the `47×38×C` grid (or a GNN over the holds) regressing `display_difficulty` and
`quality_average`, weighted by ascent count. Build it first because it (a) validates the whole data
pipeline on an easier supervised task, (b) is the **re-ranker** — generate N candidates, keep those
whose predicted grade matches the request and quality is high (this is what turns "valid hold set" into
"climb at the grade you asked for"), and (c) supplies the number to show the user.

### Alternatives
Discrete diffusion / conditional VAE over the grid for inpainting (v2, heavier). Markov / per-grade
frequency sampling are **baselines to beat**, not the product.

## The experiment

**Goal:** given `(size, angle, target grade)` → a novel, valid, on-grade climb.

1. **Data prep (done — `scripts/build-climb-dataset.py`).** Reads the gzipped snapshot, joins
   `climbs ⋈ climb_stats` for the chosen layout, decodes frames, validates (≥1 start + finish),
   assigns min-fit size, canonical-orders, builds the `(placement,role)` vocab + per-size masks, and
   writes `dataset.{train,val,test}.jsonl` (split **by uuid** so near-dupes don't leak) + `vocab.json`
   + `size_masks.json` + `meta.json` + `stats.json`. Verified end-to-end: the `--min-ascents 5` run
   produces **66,536 examples** (train 52,913 / val 6,610 / test 7,013), vocab 2,187, in ~6 s.
2. **Train** the small GPT (next-token cross-entropy, AdamW, CFG dropout) — and the CNN grade
   predictor in parallel.
3. **Sample** `[BOS][SIZE][ANGLE][GRADE]`, nucleus sampling (top-p≈0.9, temp≈0.8–1.0) under the
   legality + size mask; stop at EOS. Generate N=32, re-rank by the predictor.
4. **Evaluate** (this is what makes it an experiment, not a demo):

| Metric | Measures |
|---|---|
| **Fits-requested-size rate** | must be ~100% with masking — the size sanity check |
| **Validity rate** | start+finish, no dups, on-board |
| **Grade controllability (MAE)** | predicted vs. requested grade, **stratified by size** |
| **Novelty** | % not in training set (exact + Jaccard near-dup on hold sets) |
| **Diversity** | distinct climbs per condition; hold-usage entropy |
| **Plausibility** | reach/span heuristics; ideally a small "real vs. generated" human test |
| **Val perplexity** | held-out likelihood |

   **Baselines:** Markov over hold tokens; per-grade hold-frequency sampling; retrieve-a-real-climb-
   and-mutate-k-holds. The transformer should win on **novelty × validity × controllability** jointly.

## Integration into Snappet / snappet-mobile

Snappet is strictly **client-side, no backend** — which the tiny model size makes easy.

1. **Train offline; ship weights as a static asset.** Export GPT + CNN to **ONNX** (run via
   `onnxruntime-web`) or transformers.js. A few MB of weights live in `public/`, **lazy-loaded +
   precache-excluded** — the exact pattern already used for `sql-wasm.wasm` and the board snapshots.
2. **Build a board renderer (the app has none today).** Board Explorer is currently a results table;
   `frames` is never drawn. Add an SVG/Canvas that plots the 692 placements at their `(x,y)` (already
   in the shipped SQLite), colours selected holds by role (colours are in `placement_roles`), and
   **draws/crops to the selected size's box**. This renderer also lets the Explorer *visualise existing
   climbs* — an independent win.
3. **Surface as a "Climb Generator" tab** in Board Explorer (or a sibling app): inputs = layout +
   **size** + angle slider + target grade (+ optional seed holds); output = the rendered climb with its
   predicted grade/quality and "regenerate". Run inference in a **Web Worker** (mirror `sql.worker.ts`);
   reuse the sql.js worker for geometry + export.
4. **Close the loop with the SQLite schema.** Write a generated climb back as `frames = p{placement}
   r{role}…` into a single-climb Aurora `.db` (the `exportDb.ts` machinery + `KilterCatalogValidator`
   contract already exist) → imports straight into snappet-mobile. Also emit the raw frames string so a
   climber can recreate it on the physical board.
5. **Size gap to close in the Explorer too.** `FilterState` has `layoutId` but **no size** (`query.ts`
   never touches `edge_*`), though `product_sizes` *is* shipped. Adding a `product_sizes → box` lookup
   serves both the generator's size picker and a new **size filter** on the existing table.

## Risks / honest caveats

- **Grade accuracy is the ceiling.** Crowd grades are noisy and angle-sensitive; expect ~1 V-grade MAE
  from the predictor to bound controllability. Re-ranking helps; perfect control is unrealistic.
- **Per-size data poverty.** 7×10 / 16×12 are thin → weaker *style* there (validity still guaranteed by
  the mask). Single size-conditioned model + transfer is the mitigation.
- **Valid ≠ good.** A legal hold set can be physically awkward (unreachable spans, no feet). The quality
  head + reach heuristics mitigate; "is it *fun*" is partly subjective — validate with real climbers.
- **Long tail.** V12+ has hundreds, not thousands, of examples — scope v1 to ~V0–V10.
- **No write path to Aurora.** There's no public API to publish to the official Kilter app without their
  auth. Framing must be *"design, visualise, export"* — not *"publish to Kilter"* — and the grade is a
  model **estimate**.
- **Licensing/attribution.** Same consideration as shipping the snapshots — a model derived from public
  boardlib data needs the same owner sign-off before publishing.

## First results (implemented + trained)

The scaffold above is built and trained end-to-end — `scripts/train_generator.py` (trainer +
constrained sampler), `scripts/train_generator_colab.ipynb` (GPU run), `scripts/render_samples.py`
(visualiser), alongside the `climb_baseline.py` CPU baseline and `train_grade_predictor.py` reranker.

- **Model:** small conditional GPT — 5.31M params (dim 256 / 6 layers / 8 heads), tied embeddings,
  GPT-style init + grad clipping; loss is masked over the given `[SIZE][ANGLE][GRADE][MATCH]` prefix so
  it learns to predict holds + EOS only (a true conditional LM).
- **Data:** 52,913 train / 6,610 val sequences (≥5 ascents, layout 1) from `build-climb-dataset.py`.
- **Training:** CPU only (no GPU in-environment), AdamW, early-stopped after 7 epochs. Val perplexity
  **~1100 (init) → 31.9 (best, epoch 4)**.
- **Sampling:** constrained decoding under the per-size hold mask + no-duplicate + ≥1 start / ≥1 finish,
  so every sample is valid by construction. The trained net emits varied, realistic hold counts (12–21)
  with the right spatial structure (starts low, finish high, feet below hands) — see
  `kilter-climb-generator-samples.png` (match/no-match × easy/medium/hard at 12×12). A GPU run on the
  larger schedule should sharpen grade adherence and style; this CPU run is a correctness/feasibility
  proof, not the final model.

## Open questions for the maintainer

1. **Ship it?** The research now has a working trainer + a CPU-trained checkpoint committed (see *First
   results*). Promote to a PLAN + feature (ONNX export → "Generate" tab in Board Explorer), or park?
2. **Where does training live?** A Colab/Kaggle notebook referenced from `pdd/`, or a `scripts/`
   trainer? Weights hosting (in-repo `public/` vs. release asset) mirrors the snapshot hosting gate.
3. **Generator surface:** a new mini-app vs. a tab inside Board Explorer (the renderer + size lookup are
   shared either way).
