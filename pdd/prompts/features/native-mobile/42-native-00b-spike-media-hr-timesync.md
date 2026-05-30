# Prompt: Snappet Mobile — Phase 0b (SPIKE): media ↔ HR time-sync accuracy

**File**: pdd/prompts/features/native-mobile/42-native-00b-spike-media-hr-timesync.md
**Created**: 2026-05-30
**Project type**: Native mobile R&D spike (code lands in the separate `snappet-mobile` repo)
**Chain**: Phase 0b of the Snappet Mobile initiative
**Source**: GitHub issue [#60](https://github.com/harshal2802/Snappet/issues/60) (§3, Open Question 3)
**Plan**: `pdd/prompts/features/native-mobile/PLAN-snappet-mobile.md`
**Schema**: `pdd/context/snappet-core-schema.md`

## ⚠️ This is a SPIKE, not a feature

The deliverable is a **measured number + a recommended alignment strategy**, not product. Throwaway
measurement code is fine. This is risk #2 from #60 (the library-import model shifted time-sync from
"free" to "must prove"). Do **not** build the reel pipeline here.

## The question to answer

**When the user films with the normal camera (or a GoPro/friend's phone) and we later match media to
the HR series purely by timestamps, how accurate is that alignment — and what strategy minimizes the
error?** Concretely:
1. What is the real **clock-drift** between the HR-source device (watch/band) and the phone camera
   over a session?
2. Does **clip-internal mapping** work — i.e. mapping an offset *within* a multi-minute clip onto the
   HR curve via `creation_time` (start) + duration?
3. Are there **timezone / metadata** pitfalls (QuickTime `mvhd` UTC vs local; EXIF with no TZ;
   Android `DATE_TAKEN`) that throw alignment off by minutes/hours?

## Approach

A measurement harness with a **stopwatch ground-truth**:
- Record a session where a **visible synchronized clock/stopwatch** appears in the video (or use
  clap/marker events at known HR-series times). This gives true wall-clock for chosen video frames.
- Pull each media item's capture time from real metadata: iOS `PHAsset.creationDate` / AVAsset
  metadata; Android `MediaStore.DATE_TAKEN` / `MediaMetadataRetriever`. Also read EXIF
  `DateTimeOriginal` for photos and QuickTime `creation_time` for videos directly, to compare what
  each source reports (they can disagree).
- Compute, for known frames, the **error** between (a) the wall-clock derived from metadata + in-clip
  offset and (b) the true stopwatch wall-clock. Report distribution (median, p95, max).
- Measure drift by comparing two markers far apart in the session.

## Output format

Throwaway code + a written recommendation:
1. `experiments/media-hr-timesync/` (in `snappet-mobile` or scratch repo): the metadata readers, the
   error computation, and any platform probes used.
2. A `RESULTS.md` with: the error distribution (median / p95 / max in seconds), measured drift over
   the session, which metadata field proved most reliable per platform, and the **timezone pitfalls
   actually observed**.
3. A **recommended alignment strategy** for Phase 1: which timestamp field to trust, how to resolve
   timezone, whether a session-start reference-offset capture is needed, and how much clip-window
   padding the measured error justifies (ties back to #60 §4 padding).

## Acceptance criteria

- [ ] Real device metadata is read on at least one platform (iOS or Android); note which.
- [ ] Error vs a stopwatch/marker ground truth is quantified (median / p95 / max seconds), not asserted.
- [ ] Clip-internal mapping (offset within a long clip) is tested, not just whole-clip matching.
- [ ] Timezone handling is explicitly tested (a clip recorded/known in a non-UTC context).
- [ ] `RESULTS.md` gives a concrete recommended alignment strategy + justified padding window.
- [ ] States whether ~1 s accuracy (enough for second-window highlights, per #60 §3) is achievable.

## Constraints

- **No reel pipeline, no app UI.** Just metadata reading + arithmetic + a report.
- Don't assume a fixed timestamp semantics — *measure* what each field actually reports on the test
  device; QuickTime/EXIF/DATE_TAKEN behavior varies.
- If only one platform is testable now, say so and flag the other as a follow-up probe.

## Test plan

1. Capture (or obtain) a session video containing a visible synced stopwatch + an HR series for the
   same wall-clock window.
2. Read capture timestamps from each metadata source; note disagreements.
3. For several known frames, compute predicted-wall-clock vs true-wall-clock error; tabulate.
4. Compare two far-apart markers to estimate drift.
5. Repeat with a clip whose timezone differs from UTC to surface TZ bugs.
6. Write the recommended strategy + padding in `RESULTS.md`.
