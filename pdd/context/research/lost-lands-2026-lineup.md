# Research: Lost Lands 2026 — lineup pack

**Date**: 2026-09-16
**Outcome**: **Shipped** — `lost-lands-2026.fpack` (3,097 bytes · 22 stage-days · 220 sets), built
from `scripts/festival-lineups/lost-lands-2026.json`.

Source: the festival's four official **set-time posters** (cards 1/4 Wednesday+Thursday, 2/4 Friday,
3/4 Saturday, 4/4 Sunday), transcribed by hand. Companion to
[`PLAN-music-festivals.md`](../../prompts/features/music-festivals/PLAN-music-festivals.md) and to
the [North Coast record](north-coast-2026-lineup.md).

---

## Festival metadata

| Field | Value | Notes |
|---|---|---|
| `id` | `lost-lands-2026` | |
| `name` | `Lost Lands 2026` | Excision's festival, 8th edition |
| `location` | `Legend Valley, Thornville, OH` | |
| `startDate` | `2026-09-16` | **Wednesday pre-party**, not the Friday main start |
| `endDate` | `2026-09-20` | Sunday |
| `utcOffsetSeconds` | `-14400` | Ohio is **EDT (UTC−4)** in September |

**Seven stages across five days.** Wednesday and Thursday are pre-parties on two stages
(`Grove Stage`, `The Crater`); Friday–Sunday run six (`Prehistoric Stage`, `Wompy Woods`,
`The Crater`, `Forest Stage`, `Subsidia Stage`, `Raptor Alley`). Grove appears only on the
pre-party days; the other five only on the main days; The Crater runs all five.

| Day | Stages | Sets | Closes |
|---|---|---|---|
| Wed 09-16 | 2 | 20 | 22:30 |
| Thu 09-17 | 2 | 12 | 19:00 |
| Fri 09-18 | 6 | 64 | 04:00 |
| Sat 09-19 | 6 | 65 | 04:00 |
| Sun 09-20 | 6 | 59 | 03:00 |

## The end-time problem (read this first)

**The posters print only a START time per set.** Every other pack in this repo was transcribed from
a grid with explicit windows; this one was not. End times were therefore derived, by two rules:

1. **Within a stage-day, a set ends when the next set on that stage starts.** The poster columns are
   contiguous — card heights encode duration and no card leaves a gap — so this is reading the
   grid, not guessing. **198 of 220** end times come from here and carry the same confidence as the
   printed starts.
2. **The last set of each stage-day ends at that column's close.** 22 values, and they are not all
   equally solid:
   - **15 are curfew-backed** — the published hours are 2pm–4am Friday and Saturday, 2pm–3am
     Sunday, and every all-night column's final set starts at 03:00 (Fri/Sat) or 02:00 (Sun),
     landing exactly on the curfew with a clean 1-hour slot.
   - **1 is printed on the poster** — Friday's `Excision (2 Hour Set)` at 22:10, so 00:10.
   - **6 are genuine estimates**, extrapolated from that column's own slot length: Wed Grove 22:30
     (50-min slots), Wed Crater 22:00 (60-min), Thu Grove 19:00, Thu Crater 19:00, Sat Prehistoric
     `Illenium` → 00:00, Sun Prehistoric `Excision B2B Space Laces` → 23:00 (the card carries the
     *2026 Closing Ceremony* marker). **These six are the only times in the pack not derived from
     something printed.** If the app ever shows a closer running long, this is why.

The posters also say *"all times subject to change — check app for the latest"*, so the pack is a
snapshot of the published grid, not a live feed.

## Transcription decisions

- **The pre-parties are included**, which is why `startDate` is 09-16 and not 09-18. Wednesday and
  Thursday ship as official Lost Lands set times on the same poster carousel, at the same venue, so
  dropping them would discard data the festival published. It does mean the app shows a five-day
  festival. Excluding them is a two-line edit (drop the first two `days`, move `startDate` to
  `2026-09-18`).
- **`Secret Takeover` is a real slot, kept verbatim.** The Crater lists four consecutive unnamed
  takeover hours on Friday and Saturday and four on Sunday. They are scheduled sets with times and
  a TBA artist, so they are packed as-is rather than dropped — sequential, so no overlap.
- **B2B and special sets are one set, one artist string** — `Infekt B2B Samplifire`,
  `Sullivan King B2B Ray Volpe`, `Subtronics B2B Level Up`, `Craze B2B Dieselboy`,
  `Excision B2B Space Laces`, `FuntCase B2B Doctor P (DnB Set)`, `Æon:Mode B2B Blossom`, and the
  billed variants `Wooli (Sunset Set)`, `Excision (Detox Set)`, `Adventure Club (Throwback Set)`,
  `Black Tiger Sex Machine (Unmasked Set)`.
- **Excision plays four sets** across the weekend (Friday Prehistoric 2-hour, Sunday Wompy Woods
  detox set, Sunday Prehistoric b2b Space Laces, plus `Excision Presents Team Takeover` closing
  Raptor Alley). Different stages and times, so no overlap — all four are real.
- **Non-sets omitted**: the *"Create your own schedule in the Lost Lands app"* panel filling Raptor
  Alley's daytime column, and Thursday's *"Mega B2B2B2B pre-party at Prehistoric Stage + label
  takeover at The Crater"* notice, which announces unlisted programming rather than a timed set.
- **Casing follows each artist's usual styling** rather than the poster's all-caps — `Illenium`,
  `NGHTMRE`, `ARMNHMR`, `HALIENE`, `IMANU`, `MYTHM`, `Au5`, `LAYZ`, `HVDES`, `2DY4`, `YVM3`,
  `$J`, `ROI*`. Non-ASCII preserved: `Æon:Mode B2B Blossom`.

## The 4am nights

Unlike every previous pack, Lost Lands runs past midnight on all three main days, so this is the
first pack to exercise the builder's 06:00 rollover in anger. It works: a set listed at 00:15
resolves to the *next* calendar date while still belonging to the prior festival day, and Friday's
`Oliverse 03:00–04:00` lands at `2026-09-19T03:00 → 04:00` inside Friday's 06:00→06:00 window.

⚠️ **Latent trap** found while testing: a set *ending* at or after 06:00 is rejected as "inverted",
because the start rolls to the next day and the end does not. Nothing here comes close to 6am, but
a sound-camp set would hit it.

## Rebuilding

```bash
python3 scripts/build-fpack.py lost-lands-2026
```

The builder self-checks the round-trip and mirrors snappet-mobile's `FestivalPackValidator`. This
pack builds clean and the three pre-existing packs still reproduce byte-for-byte.

## Sources

- **Official set-time posters**, four-card carousel — the schedule this pack is built from
- [Lost Lands Festival](https://www.lostlandsfestival.com/) · [2026 Lineup](https://www.lostlandsfestival.com/lineup/)
- [Lost Lands 2026 Set Times, Maps, And Essential Info — EDM Identity](https://edmidentity.com/2026/09/12/lost-lands-2026-set-times-essentials/)
- [Diving Into Every Stage At Lost Lands 2026 — EDM Identity](https://edmidentity.com/2026/09/04/every-stage-lost-lands-2026/)
- [Lost Lands 2026 Lineup — EDM Identity](https://edmidentity.com/2026/05/12/lost-lands-2026-lineup/)
