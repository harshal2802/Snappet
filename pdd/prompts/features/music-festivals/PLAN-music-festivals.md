# PLAN: Snappet Lineups — festival `.fpack` packs on the Pages site

**Status**: IMPLEMENTED (companion PR to snappet-mobile festival prompt 02).
**Owner**: pdd
**Route**: `/music-festivals/` (static hosted data + index page, NOT a React mini-app)
**New script**: `scripts/build-fpack.py` (+ lineup sources in `scripts/festival-lineups/`)
**Cross-repo contract**: every published `.fpack` must decode via snappet-mobile's
`FestivalPack.decode(fpack:)` and pass its `FestivalPackValidator` — the mobile repo pins the
published bytes in `FestivalPackWireCompatTests` (a base64 fixture of `glastonbury-2026.fpack`),
so a format drift on either side fails a test before it fails a user.

## Goal

Host **festival lineup packs** for the Snappet mobile app's Festival mini-app, exactly the way
`board-data/` hosts the Kilter climb catalog: static files on this user-controlled Pages origin,
one user-initiated GET per pack, no accounts, no tracking, offline forever after install
(festivals have no signal). The app's *Download from Snappet Lineups* browse screen consumes
`music-festivals/manifest.json`; humans get a small dark index page listing the same packs.

## What ships

- `src/frontend/public/music-festivals/`
  - `manifest.json` — the machine index (`{ generatedAt, festivals: [{ id, name, location,
    startDate, endDate, file, stages, sets, sizeBytes, updatedAt }] }`).
  - `glastonbury-2026.fpack`, `tomorrowland-2026-w2.fpack` — the starter packs (multi-day,
    multi-stage, late-night sets crossing midnight).
  - `index.html` — human-readable page (renders from `manifest.json`, so it can't drift).
- `scripts/build-fpack.py` — the community pack builder: friendly lineup JSON
  (`scripts/festival-lineups/<id>.json`, local `HH:MM` times) → wire `.fpack` + regenerated
  manifest. Deterministic output (sorted keys, compact JSON) so packs are reproducible; validates
  the same rules the app's installer enforces so a pack that builds here always installs there.
- `vite.config.ts` — `music-festivals/**` joins `board-data/**` in the PWA `globIgnores`
  (hosted data, not app shell).

## The wire format (do not drift)

`.fpack` = `"FPAK"` (4 bytes) + version byte (`0x01`) + **raw-DEFLATE** JSON.
⚠️ Raw DEFLATE (`zlib.compressobj(..., wbits=-15)`) — NOT `zlib.compress()` (zlib-wrapped) and NOT
gzip. The app inflates with Apple `Compression`'s `COMPRESSION_ZLIB` (= raw deflate); a wrapped
blob is rejected as "damaged". Set times are ISO-8601 **with the festival's own UTC offset**;
festival days roll over at 06:00 (a `HH:MM < 06:00` source time belongs to the next calendar date
but the same poster day).

## Submitting a lineup

PR a JSON file to `scripts/festival-lineups/` (see the two shipped sources for the shape) and run
`python3 scripts/build-fpack.py` — commit the regenerated `.fpack` + `manifest.json` with it.
Lineups are public schedule data; times are the published schedule.
