# Snappet Core — shared data schema

**Last updated**: 2026-05-30
**Status**: v0 draft (pre-implementation)
**Source of truth**: this file. Both the web hub and the native `snappet-mobile` app reference it.
**Related**: [`pdd/context/decisions.md`](./decisions.md) (separate-repo decision), GitHub issue
[#60](https://github.com/harshal2802/Snappet/issues/60) (deep research), `pdd/prompts/features/native-mobile/PLAN-snappet-mobile.md`.

---

## Purpose

"Snappet Core" is the **shared on-device data layer** that turns Snappet from a bag of unrelated
mini-apps into a suite whose value *compounds* — a workout feeds the daily dashboard, a highlight
reel attaches to that day's journal, etc. (issue #60, §D).

This doc is the **contract**, not an implementation. It is deliberately platform-agnostic:
- **Web** (this repo): realized in `localStorage` / `IndexedDB`, keyed `snappet:*` (matches existing
  conventions — see `lib/usage.ts`, `useLocalStorage`).
- **Native** (`snappet-mobile`): realized in a single on-device store (SQLite / Core Data / Room)
  reading/writing these same entity shapes.

Native does **not** import this at runtime — it copies/generates types from this spec. When the
schema changes, bump `schemaVersion` here first, then propagate to both platforms.

## Principles (inherited from project constraints)

- **On-device first, no backend.** Every entity lives on the user's device. Nothing is transmitted.
  Cross-device sync, if ever added, is a separate explicit decision — not assumed here.
- **Privacy by construction.** Health + media are the most sensitive data Snappet touches. Modules
  read another module's data only with explicit per-module consent (see *Consent* below).
- **Additive evolution.** Prefer adding optional fields over renaming/removing. Every entity carries
  `schemaVersion` so a reader can migrate.

## Conventions

- **IDs**: opaque strings (UUID v4 native; existing `crypto.randomUUID()`-style on web).
- **Timestamps**: ISO-8601 UTC strings (`createdAt`, `updatedAt`) **plus**, where wall-clock matters
  for correlation (media, HR samples), a device-local capture time — see the time-sync caveat in #60 §3.
- **Namespacing (web)**: `snappet:<domain>:<v>` localStorage keys, mirroring `snappet:usage:v1`.
- **No PII beyond what the user enters.** Health metrics are derived on-device.

---

## Core entities (v0)

> These are *contract shapes*, shown as TypeScript for precision. Native mirrors them.

```ts
// Schema version stamped on every persisted record so readers can migrate.
type SchemaVersion = number; // current: 0

// ── Workout: one tracked session (the flagship producer) ──────────────────
interface Workout {
  id: string;
  schemaVersion: SchemaVersion;
  activity: 'climbing' | 'running' | 'dance' | 'strength' | 'other';
  startedAt: string;            // ISO-8601 UTC
  endedAt: string;              // ISO-8601 UTC
  source: 'apple-watch' | 'wear-os' | 'ble-band' | 'manual';
  hrSeries: HrSample[];         // authoritative, post-workout, de-duplicated (see #60 §3)
  hrRestBpm?: number;           // for %HR-reserve normalization (#60 §4)
  hrMaxBpm?: number;
  createdAt: string;
  updatedAt: string;
}

interface HrSample {
  t: number;                    // seconds from workout start (monotonic, drift-corrected)
  bpm: number;
  wallClock?: string;           // ISO-8601 UTC — for media correlation when present
}

// ── MediaItem: a photo/clip imported from the library, scoped to a window ──
interface MediaItem {
  id: string;
  schemaVersion: SchemaVersion;
  workoutId?: string;           // set when matched to a workout's time window
  kind: 'video' | 'photo';
  localIdentifier: string;      // PHAsset.localIdentifier (iOS) / MediaStore id (Android)
  capturedAt: string;           // from EXIF/QuickTime/DATE_TAKEN — device-local, TZ-resolved
  durationSec?: number;         // videos only; needed for clip-internal HR mapping
  createdAt: string;
}

// ── Highlight: a scored moment on the HR curve, mapped to media ───────────
interface Highlight {
  id: string;
  schemaVersion: SchemaVersion;
  workoutId: string;
  mediaItemId: string;
  kind: 'high' | 'low';         // effort peak vs recovery trough (#60 §4)
  atSec: number;                // offset into the media item
  score: number;                // 0..1, intensity-derived rank
  clipStartSec: number;         // padded window (biased earlier for HR latency, #60 §3)
  clipEndSec: number;
  pinned?: boolean;             // user manually kept/added (auto-generate-then-edit, #60 §B)
}

// ── Reel: an assembled highlight video (the user-facing artifact) ─────────
interface Reel {
  id: string;
  schemaVersion: SchemaVersion;
  workoutId: string;
  highlightIds: string[];       // ordered
  style?: string;               // saved template / preset name
  music?: string;
  exportedAssetId?: string;     // library identifier of the rendered output
  createdAt: string;
  updatedAt: string;
}

// ── DayLog: the aggregation surface the daily home renders ────────────────
interface DayLog {
  date: string;                 // YYYY-MM-DD, device-local
  schemaVersion: SchemaVersion;
  workoutIds: string[];
  reelIds: string[];
  // Other mini-apps append their own day-scoped refs here (journal entry,
  // pomodoro sessions, tally counts…) so the home aggregates across the suite.
  moduleRefs: { module: string; refId: string; summary?: string }[];
}
```

### Relationship sketch

```
Workout ─1─┬─*─ HrSample
           ├─*─ MediaItem (matched by time window)
           └─*─ Highlight ─1─ MediaItem
                   │
                  Reel (ordered Highlights)
DayLog ─*─ Workout, Reel, + moduleRefs from any mini-app
```

---

## Consent model (cross-module data sharing)

Sharing is **opt-in per reader-module**, not global. The store exposes scoped reads; a module may
read another's data only after the user grants that specific pairing.

```ts
interface ModuleGrant {
  reader: string;               // e.g. 'journal'
  scope: string;                // e.g. 'workout:summary' | 'reel:read'
  grantedAt: string;
  revokedAt?: string;
}
```

- Grants are surfaced at the **just-in-time moment** value is offered ("Attach today's workout reel
  to your journal entry?"), never as a bulk upfront request (#60 §C).
- Revocable any time; revocation stops future reads (past copies the user already composed remain).
- The daily home reads only `DayLog` + entities the user has surfaced — it does not bypass grants.

> **Open question (not yet decided)**: the exact consent UX and whether grants are per-module-pair
> or per-scope. Tracked in #60 open-questions. Do not treat the above as final.

---

## Versioning

- `schemaVersion` starts at **0** (pre-release; breaking changes allowed freely until v1).
- At first native+web shipment, freeze **v1**; thereafter additive-only or a migration is required.
- Changes land **here first** (bump the number + note what changed), then in both platforms.

## What this is NOT

- Not a backend or a network API — purely an on-device contract.
- Not a runtime dependency shared across repos — it is copied/generated per platform.
- Not a place for raw third-party SDK payloads — normalize into these shapes at the edge.
