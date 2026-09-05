# Research: North Coast Music Festival 2026 — lineup pack

**Date**: 2026-09-05
**Outcome**: **Shipped** — `north-coast-2026.fpack` (1,977 bytes · 18 stages · 125 sets), built from
`scripts/festival-lineups/north-coast-2026.json`.

Source of the schedule: the festival's own **daily set-time posters** (cards 2/4, 3/4 and 4/4 of the
Instagram carousel on [@northcoastfest](https://www.instagram.com/northcoastfest/)), transcribed by
hand. Companion to
[`pdd/prompts/features/music-festivals/PLAN-music-festivals.md`](../../prompts/features/music-festivals/PLAN-music-festivals.md).

---

## Festival metadata

| Field | Value | Notes |
|---|---|---|
| `id` | `north-coast-2026` | |
| `name` | `North Coast 2026` | 16th edition |
| `location` | `SeatGeek Stadium, Bridgeview, IL` | Chicago metro |
| `startDate` | `2026-09-04` | Friday |
| `endDate` | `2026-09-06` | Sunday (Labor Day weekend) |
| `utcOffsetSeconds` | `-18000` | America/Chicago is **CDT (UTC−5)** in September, not CST |

**Six stages**, consistent across all three days:
`The Stadium` · `The Shipyard` · `The Vega` · `Fire Pit` · `OCB Dome` · `Silent Disco`

**Day shape** — music starts 14:00 CT daily. Friday and Saturday run to midnight (latest sets end
23:59 and 23:55); **Sunday's curfew is early**, with the last set ending 22:30. That matches the
independently-reported daily hours, which is a useful check on the transcription.

| Day | Sets | Stadium closer |
|---|---|---|
| Fri 09-04 | 42 | Fisher 22:25–23:59 |
| Sat 09-05 | 43 | GRiZ 22:40–23:55 |
| Sun 09-06 | 40 | Illenium B2B Slander 21:15–22:30 |

## Transcription decisions

These are the judgement calls behind the source file — worth recording, because a future re-scrape
of the same posters should land on the same JSON.

- **OCB Dome is one stage, not two.** The poster's OCB Dome column tags each set with a colour chip
  — red for *Bunker*, blue for *Chill Dome* — so the column is really two rooms sharing a lane. The
  wire format has no sub-stage concept, and the two rooms are **strictly sequential** on all three
  days (verified: no two OCB Dome sets overlap), so they merge into a single `OCB Dome` stage
  without tripping the validator's same-stage overlap check. The Bunker/Chill Dome split is lost;
  that seemed a better trade than inventing two stage names the poster doesn't print.
- **B2B sets are one set, one artist string** — `Levity B2B Tape B`, `Illenium B2B Slander`,
  `Mad Dubz B2B VKTM`, `Kevin Alvarez B2B Lee Sandstrom`. Splitting them into two sets on one stage
  would be rejected as an overlap, and is wrong anyway.
- **Casing is normalised to the artists' usual styling**, not the poster's all-caps
  (`GRiZ`, `TroyBoi`, `ALLEYCVT`, `ARMNHMR`, `dj_dave`, `BUNT.`, `3BallMTY`). The poster sets every
  name in caps as a design choice, so it isn't evidence about the name itself. Non-ASCII stylings
  are preserved: `DIØN`, `DØMINA`, `Ham Ñ Cheez`, `Partî`.
- **`YDG` plays twice on Saturday** — a Stadium set at 19:25 and `YDG (House Set)` in the OCB Dome
  at 16:30. Different stages, no overlap; both are real.
- **Presenter branding is not a set.** `BROWNIES & LEMONADE` (Friday, Shipyard foot) and
  `EDM CHICAGO` (Fire Pit foot) label who curates the stage — they are not artists and are omitted.
- **No set crosses the 06:00 rollover.** Every day ends before midnight, so this pack has no
  `HH:MM < 06:00` next-day entries and the rollover rule never fires.

## Rebuilding

```bash
python3 scripts/build-fpack.py north-coast-2026   # rebuilds the pack + refreshes the manifest
```

The builder self-checks the round-trip and mirrors snappet-mobile's `FestivalPackValidator` (empty
artist, inverted window, same-stage overlap, set outside the day window, day outside the festival
dates, duplicate day, bad offset), so a clean build here installs cleanly there. This pack builds
clean, and the two pre-existing packs still reproduce byte-for-byte.

## Sources

- **Daily set-time posters** — [@northcoastfest on Instagram](https://www.instagram.com/northcoastfest/) (carousel cards 2/4 Friday, 3/4 Saturday, 4/4 Sunday) — the schedule this pack is built from
- [2026 Daily Schedule — North Coast Music Festival](https://www.northcoastfestival.com/music/schedule/)
- [2026 Lineup — North Coast Music Festival](https://www.northcoastfestival.com/music/lineup/)
- [Festival Experience — six stages](https://www.northcoastfestival.com/experience/)
- [North Coast Announces Initial 2026 Lineup — EDM Identity](https://edmidentity.com/2026/02/02/north-coast-2026-phase-1-lineup/)
- [North Coast Drops Off More Artists (phase two) — EDM Identity](https://edmidentity.com/2026/04/25/north-coast-2026-phase-2-lineup/)
