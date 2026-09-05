# Research: North Coast Music Festival 2026 — lineup pack source

**Date**: 2026-09-05
**Outcome**: **Blocked on set times.** Everything the `.fpack` wire format needs *except* the
per-set start/end times is confirmed below, along with a drop-in source skeleton. The published
set-time grid could not be retrieved from this environment (see *Why this isn't a pack yet*), and
the packs under `music-festivals/` are consumed by snappet-mobile as **the published schedule** —
so no times were guessed.

**To finish**: paste the official grid into the skeleton, save it as
`scripts/festival-lineups/north-coast-2026.json`, run `python3 scripts/build-fpack.py`, commit the
regenerated `.fpack` + `manifest.json`. Nothing else in the repo needs to change.

Companion to [`pdd/prompts/features/music-festivals/PLAN-music-festivals.md`](../../prompts/features/music-festivals/PLAN-music-festivals.md).

---

## Festival metadata (confirmed)

| Field | Value | Notes |
|---|---|---|
| `id` | `north-coast-2026` | matches the `<id>.fpack` / `<id>.json` convention |
| `name` | `North Coast 2026` | 16th edition |
| `location` | `SeatGeek Stadium, Bridgeview, IL` | Chicago metro |
| `startDate` | `2026-09-04` | Friday |
| `endDate` | `2026-09-06` | Sunday (Labor Day weekend) |
| `utcOffsetSeconds` | `-18000` | America/Chicago is **CDT (UTC−5)** in September, not CST |

**Daily windows** — doors 14:00 CT all three days; music ends **00:00** Friday and Saturday,
**22:30** Sunday. Every set therefore lands inside the builder's 06:00→06:00 day window with room
to spare, and no set crosses the 06:00 rollover, so no `HH:MM < 06:00` next-day entries are
expected for this festival.

**Six stages** (the pack's `stages[].name` values):
`Stadium` · `Vega` · `Shipyard` · `Firepit` · `Chill Dome` · `Silent Disco`

The Chill Dome is new for 2026. Silent Disco may or may not be worth packing — it typically runs
unbilled/back-to-back host sets; drop the stage entirely rather than inventing filler sets for it,
since the builder rejects a stage with no sets.

## Artist roster (confirmed, day assignment NOT confirmed)

Corroborated across the phase-one and phase-two announcements. Day and stage placement for these
names is **not** established — treat this as the pool to slot into the grid, not as an ordering.

**Headliners / top billing** — FISHER · GRiZ · ILLENIUM B2B SLANDER · Porter Robinson (DJ set) ·
Levity B2B Tape B · GRYFFIN · Ganja White Night · Sammy Virji · Crankdat · Wooli · Jade Cicada ·
Chris Lorenzo (special guest)

**Melodic bass** — ARMNHMR · Dabin · William Black
**House** — Tchami · Nostalgix · Chris Lorenzo · Wuki
**Bass** — TroyBoi · ALLEYCVT · Viperactive · Holy Priest
**Techno** — Restricted · Lilly Palmer · Marie Vaunt · Alignment
**Drum & bass** — Bou · Reaper
**Other billed** — BUNT · DRAMA (DJ set)
**Phase two additions** — Interplanetary Criminal · Level Up · Sippy · Jigitz

Billing runs to 75+ artists; the above is the reliably-attested subset. The official lineup page is
the authority for the rest.

## Why this isn't a pack yet

The `.fpack` format requires a start and end time for **every** set — `build-fpack.py` rejects a
stage with no sets, and snappet-mobile renders whatever times ship as the real schedule. The set-time
grid lives on `northcoastfestival.com/music/schedule/` and on the aggregators (Festival Dust,
Festiplannr, JamBase, Music Festival Wizard), and **all of them are blocked by this environment's
network egress policy** — only GitHub and the package registries are reachable. Web search returns
page summaries rather than page content, and it returned *three mutually contradictory* answers for
the single question "what time does FISHER play on Friday" (`14:45–15:30`, `22:25–23:59`, and "not
available"), which is exactly the failure mode that must not reach a pack.

So: metadata and roster are recorded here, times are left to whoever can open the schedule page.

## Drop-in source skeleton

Save as `scripts/festival-lineups/north-coast-2026.json` **once the sets are filled in** — any
`*.json` in that directory is picked up by the builder, so an incomplete file will fail the build
for every pack, not just this one. Times are festival-local `HH:MM`, `["Artist", "start", "end"]`.

```json
{
  "id": "north-coast-2026",
  "name": "North Coast 2026",
  "location": "SeatGeek Stadium, Bridgeview, IL",
  "startDate": "2026-09-04",
  "endDate": "2026-09-06",
  "utcOffsetSeconds": -18000,
  "updated": "2026-09-05",
  "days": [
    {
      "date": "2026-09-04",
      "stages": [
        { "name": "Stadium",  "sets": [["Artist", "14:00", "15:00"]] },
        { "name": "Vega",     "sets": [["Artist", "14:00", "15:00"]] },
        { "name": "Shipyard", "sets": [["Artist", "14:00", "15:00"]] },
        { "name": "Firepit",  "sets": [["Artist", "14:00", "15:00"]] },
        { "name": "Chill Dome", "sets": [["Artist", "14:00", "15:00"]] }
      ]
    },
    { "date": "2026-09-05", "stages": [] },
    { "date": "2026-09-06", "stages": [] }
  ]
}
```

Then:

```bash
python3 scripts/build-fpack.py north-coast-2026   # builds the pack, refreshes the manifest
```

The builder self-checks the round-trip and mirrors snappet-mobile's `FestivalPackValidator`
(empty artist, inverted window, same-stage overlap, set outside the day window, day outside the
festival dates, duplicate day, bad offset), so a clean build here installs cleanly there.

**Two things to watch for this lineup specifically:**

- **B2B sets** — `ILLENIUM B2B SLANDER` and `Levity B2B Tape B` are one set each, one artist
  string. Don't split them into two overlapping sets; the validator rejects same-stage overlap.
- **Sunday's early curfew** — Sunday ends at 22:30, so a Sunday set running to midnight is a
  transcription error, not a late night.

## Sources

- [2026 Lineup — North Coast Music Festival](https://www.northcoastfestival.com/music/lineup/)
- [2026 Daily Schedule (set times by stage)](https://www.northcoastfestival.com/music/schedule/) — the grid this doc is missing
- [Festival Experience — six stages](https://www.northcoastfestival.com/experience/)
- [North Coast Announces Initial 2026 Lineup — EDM Identity](https://edmidentity.com/2026/02/02/north-coast-2026-phase-1-lineup/)
- [North Coast Drops Off More Artists (phase two) — EDM Identity](https://edmidentity.com/2026/04/25/north-coast-2026-phase-2-lineup/)
- [North Coast Music Festival Unveils Massive 2026 Lineup — EDM.com](https://edm.com/events/north-coast-music-festival-2026-lineup/)
- [FISHER, Illenium, Porter Robinson & More — JamBase](https://www.jambase.com/article/north-coast-music-festival-2026-lineup)
- [North Coast Music Festival 2026 — Music Festival Wizard](https://www.musicfestivalwizard.com/festivals/north-coast-music-festival-2026/)
