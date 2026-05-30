# PLAN: Snappet Mobile (native iOS + Android)

**Status**: drafting
**Owner**: pdd
**Lives in**: a **separate repo** — `snappet-mobile` (see [`pdd/context/decisions.md`](../../../context/decisions.md),
[2026-05-30] entry). This PLAN and the Phase-0 spike prompts live *here* (the product-brain repo);
the code they produce lives in `snappet-mobile`.
**Related**: GitHub issue [#60](https://github.com/harshal2802/Snappet/issues/60) (full deep research —
the source of truth for every claim below), [`pdd/context/snappet-core-schema.md`](../../../context/snappet-core-schema.md).

## Goal

Ship a native app whose flagship is **workout-tracking + HR-driven auto-highlight reels**: track a
workout's heart rate (Apple Watch / Wear OS / BLE band), let the user film however they like, then
**auto-find the media shot during the workout window and assemble a highlight reel ranked by HR
intensity** — minimal manual work by default, full control for power users. The feature is also the
proof of the broader **Snappet daily-app-suite** thesis (mini-apps sharing one on-device data layer
→ a unified daily home).

## Why now / why native

The capability is web-impossible: live workout HR needs HealthKit + a watchOS companion (iOS) or Wear
OS Health Services (Android), and on-device reel assembly needs AVFoundation / Media3 — none available
to a PWA (#60 Parts I–II). The existing web hub stays as-is; this is a new product line.

## Guiding product decisions (from #60)

- **Library-import first**, not in-app capture: auto-find media in the workout time window; in-app
  capture is a later optional power-user mode (#60 §A).
- **Auto-generate-then-edit**: produce a finished, playable default reel, then offer Share /
  Regenerate / Edit. The default must be genuinely good — most users never customize (#60 §B).
- **Progressive disclosure**: one-tap casual path; advanced controls (intensity, padding, overlays,
  manual timeline, saved styles) behind "Edit" (#60 §B).
- **Value-first, just-in-time permissions**; full-library access primed with multi-select fallback
  (#60 §C).
- **iOS-first** native Swift; the watchOS + HealthKit + AVFoundation path is where the risk lives
  (#60 §6). Android (Wear OS + Health Connect + Media3) comes after the algorithm is proven.
- **Snappet Core** shared on-device data layer + a daily-home card prove the suite thesis even in the
  MVP (#60 §D, schema spec).

## The make-or-break risk

The flagship premise — *does a single user's own HR pick highlights they actually prefer?* — has only
**indirect** scientific support (audience-aggregate HRV on films, not personal HR on personal footage;
a stronger variant was *refuted* in the research). **This is validated in Phase 0 before building the
pipeline** (#60 §E, Open Question 1).

## Phases & prompt chain

| Phase | Prompt file | Scope |
|---|---|---|
| 0a | `41-native-00a-spike-hr-highlight-efficacy.md` | **Spike**: does the user's own HR pick preferred highlights vs scene-detection vs manual? Make-or-break A/B. |
| 0b | `42-native-00b-spike-media-hr-timesync.md` | **Spike**: media-timestamp ↔ HR-sample sync accuracy vs stopwatch ground-truth; TZ/clip-internal mapping. |
| 0c | _(TBD)_ | **Spike**: AVMutableComposition auto-assembly from hardcoded timestamps (on-device reel proof). |
| 0d | _(TBD)_ | **Spike**: watchOS → iPhone live-HR relay (Watch Connectivity vs workout mirroring). |
| 1  | _(TBD)_ | **iOS MVP**: Apple Watch + one activity + library import + %HRR highlight engine + on-device reel + Snappet Core + daily-home card. |
| 2  | _(TBD)_ | **Polish iOS**: more activities, photos, advanced editor, telemetry overlays, hands-free HiLight tag, in-app capture (optional), iOS 26 path. |
| 3  | _(TBD)_ | **Suite expansion**: wire existing tools into Snappet Core + per-module consent; richer daily home; tasteful habit/streaks. |
| 4  | _(TBD)_ | **Android**: Wear OS Health Services + Health Connect + Media3 Transformer; decide native-Kotlin vs RN shared orchestration. |
| 5  | _(TBD)_ | **Generic bands**: BLE Heart Rate Profile client (WHOOP 3.0/4.0 first; expand per-vendor). |

> Only Phase-0 spike prompts are authored now. Later phases are scaffolded but intentionally left
> `TBD` — author each one only after the prior phase's results are in (Phase 1 in particular depends
> entirely on Phase 0a's verdict).

## Open questions (from #60 — resolve as phases proceed)

1. **[flagship]** Does one user's own HR predict their preferred highlights? → Phase 0a.
2. Concrete Snappet Core shared-data + cross-module consent UX. → schema spec (draft) + Phase 3.
3. Clock-drift magnitude & best media↔HR alignment. → Phase 0b.
4. Best HR detection params (zone vs derivative vs %HRR; smoothing window) per activity. → Phase 0a/1.
5. iOS limited Photo Library vs Android Photo Picker behavior for time-window discovery. → Phase 1.
6. Current App Store HealthKit + Health Connect policy specifics. → before Phase 1 submission.
7. Which bands beyond WHOOP expose SDK-free BLE HR. → Phase 5.
8. Right streak/notification balance without guilt/fatigue. → Phase 3.

## Notes

- Each phase = a separate prompt + separate PR (in `snappet-mobile` for code; here for prompt assets).
- Keep prompts self-contained: assume the reader has only the context files, this PLAN, the schema
  spec, and issue #60.
- Spike prompts target **throwaway/measurement code** — the deliverable is a *decision*, not shippable
  product. Say so in the prompt so the AI optimizes for evidence, not polish.
