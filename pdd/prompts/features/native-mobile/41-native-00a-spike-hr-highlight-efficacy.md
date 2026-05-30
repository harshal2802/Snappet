# Prompt: Snappet Mobile — Phase 0a (SPIKE): HR-highlight efficacy

**File**: pdd/prompts/features/native-mobile/41-native-00a-spike-hr-highlight-efficacy.md
**Created**: 2026-05-30
**Project type**: Native mobile R&D spike (code lands in the separate `snappet-mobile` repo)
**Chain**: Phase 0a of the Snappet Mobile initiative
**Source**: GitHub issue [#60](https://github.com/harshal2802/Snappet/issues/60) (§E, Open Question 1)
**Plan**: `pdd/prompts/features/native-mobile/PLAN-snappet-mobile.md`
**Schema**: `pdd/context/snappet-core-schema.md`

## ⚠️ This is a SPIKE, not a feature

The deliverable is a **decision backed by evidence**, not shippable product. Optimize for fast,
honest measurement over polish. Throwaway code is fine. **Do not** build UI, auth, the real data
layer, or anything beyond what's needed to answer the question. If the answer is "no," that is a
*successful* spike — it saves us building the whole pipeline on a false premise.

## The question to answer

**Does a single user's OWN heart-rate time-series pick the workout-video highlights *they
themselves* prefer — better than scene-detection and competitively with their own manual picks?**

Why it matters: the flagship premise of the whole app. The research (#60 §E) found only *indirect*
support (audience-aggregate HRV on films, not one person's own HR on their own footage); a stronger
"HRV → trailer" claim was *refuted*. So this must be measured before Phase 1 is built.

## Approach

A small offline experiment harness (CLI/script or minimal notebook — implementer's choice of
language; Python or TypeScript both fine since this is throwaway and lives outside the app build).

**Inputs** (use real data if available, else realistic synthetic + a documented plan to re-run on
real data):
- One or more workout sessions, each = a continuous HR series (timestamped) + a set of video clips
  with capture timestamps spanning the session (climbing or running per the MVP activity).
- A **ground-truth** set of "good moments": the user's own manual highlight picks for each session.

**Three candidate selectors**, each emits a ranked list of N highlight moments per session:
1. **HR-based** — the candidate under test. Implement the #60 §4 sketch: smooth (moving-avg /
   Savitzky-Golay ~5–15 s) → normalize to **% heart-rate reserve** → score by peak level AND by
   rate-of-change `dHR/dt` → pick top-N high (and some low/recovery) moments → pad windows (bias
   earlier for HR latency). Expose the key params (smoothing window, high-vs-low mix, threshold).
2. **Scene-detection baseline** — a content-based selector (e.g. frame-difference / motion / a
   stock shot-boundary or saliency heuristic). The "non-biometric" competitor.
3. **Random baseline** — uniformly sampled moments. The floor.

**Comparison** — for each selector vs the user's manual ground truth, compute agreement metrics:
- Precision@N / recall@N of selected moments vs ground-truth moments (with a tolerance window, e.g.
  ±a few seconds, since exact frames won't match).
- A rank-correlation (e.g. Spearman) between selector score and the user's preference ordering where
  available.
- Report HR-based **vs scene-detection** and **vs random** explicitly — beating random is the floor;
  the real bar is beating scene-detection.

## Output format

Throwaway code + a written verdict. Specifically:
1. `experiments/hr-highlight-efficacy/` (in `snappet-mobile`, or a standalone scratch repo) containing
   the harness, the three selectors, and the metric computation.
2. A short `RESULTS.md` reporting: dataset used (real vs synthetic, N sessions), the metric table
   (HR vs scene vs random), the HR params that performed best, and **a clear GO / NO-GO / NEEDS-REAL-DATA
   verdict** with reasoning.
3. If synthetic data was used, an explicit, concrete plan for re-running on ≥3 real sessions before
   trusting the verdict.

## Acceptance criteria

- [ ] All three selectors run end-to-end on the same input and emit ranked moments.
- [ ] HR selector implements %HRR normalization + smoothing + peak/derivative scoring (not raw BPM).
- [ ] Metrics computed against the user's manual ground truth with a documented tolerance window.
- [ ] Results table compares HR vs scene-detection vs random.
- [ ] `RESULTS.md` states a GO / NO-GO / NEEDS-REAL-DATA verdict with the evidence behind it.
- [ ] Limitations are stated honestly (synthetic-data caveat, small N, activity scope).

## Constraints

- **No app code.** No HealthKit/Health Connect integration, no Swift/Kotlin app target, no UI. Read
  HR + media metadata from files. (Live capture is a *later* spike, 0d.)
- Don't overfit the HR params to a single session — report on held-out sessions if N allows, or flag
  that N is too small to conclude.
- Be skeptical of your own positive result — a tiny synthetic dataset "confirming" the premise proves
  nothing. Say so.

## Test plan

1. Run the harness on the input; confirm all three selectors produce ranked moments.
2. Sanity-check the HR selector by eye on one session: do its "high" picks land on genuine effort spikes?
3. Compute the metric table; confirm HR beats random (floor check).
4. Read the HR-vs-scene-detection result and write the verdict.
5. If synthetic-only: do NOT mark GO — mark NEEDS-REAL-DATA and attach the re-run plan.
