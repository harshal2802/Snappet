#!/usr/bin/env python3
"""Build Snappet Festival `.fpack` lineup packs + the `music-festivals/` manifest.

The Snappet mobile app installs festival lineups from static packs hosted on this
site at `/music-festivals/` (the `board-data/` hosting pattern: user-controlled
host, one user-initiated GET, offline after install). This script turns the
human-editable lineup sources in `scripts/festival-lineups/*.json` into the wire
form the app's `FestivalPack.decode(fpack:)` reads, and regenerates
`src/frontend/public/music-festivals/manifest.json`.

WIRE FORMAT (must match snappet-mobile `FestivalPack.swift` byte-for-byte):

    "FPAK" (4 bytes) + version byte (0x01) + raw-DEFLATE(JSON)

⚠️  raw DEFLATE — no zlib header/checksum, no gzip wrapper. The app inflates with
Apple's `Compression` framework (`COMPRESSION_ZLIB` == raw DEFLATE), so use
`zlib.compressobj(..., wbits=-15)`. A plain `zlib.compress()` or `gzip` blob is
REJECTED by the app with "That pack is damaged".

The JSON payload (all keys required by the app's Codable):

    { "formatVersion": 1, "id", "name", "location", "startDate", "endDate",
      "utcOffsetSeconds", "days": [ { "date", "stages": [ { "name",
      "sets": [ { "artist", "start", "end" } ] } ] } ] }

Set times are ISO-8601 with the festival's own UTC offset
(`2026-06-27T22:15:00+01:00`).

SOURCE FORMAT (`scripts/festival-lineups/<id>.json`) — friendly local times:

    { "id": "glastonbury-2026", "name": "...", "location": "...",
      "startDate": "2026-06-24", "endDate": "2026-06-28",
      "utcOffsetSeconds": 3600, "updated": "2026-06-22",
      "days": [ { "date": "2026-06-26", "stages": [
          { "name": "Pyramid Stage",
            "sets": [["Artist", "21:45", "23:15"], ...] } ] } ] }

Times are `HH:MM`, festival-local. A time before 06:00 belongs to the NEXT
calendar date (festival days roll over at 06:00 — a 01:00 set is still "Saturday
night"), mirroring the app's `FestivalDay.rolloverHour`.

Usage:
    python3 scripts/build-fpack.py                # build every source + manifest
    python3 scripts/build-fpack.py glastonbury-2026   # build one (still refreshes manifest)

The build mirrors the app's `FestivalPackValidator` (empty artist, inverted
window, same-stage overlap, set outside the 06:00→06:00 day window, day outside
the festival dates, duplicate day, offset out of −12:00…+14:00) so a pack that
builds here always installs there.
"""

from __future__ import annotations

import json
import sys
import zlib
from datetime import date, datetime, time, timedelta
from pathlib import Path

MAGIC = b"FPAK"
FORMAT_VERSION = 1
ROLLOVER_HOUR = 6

REPO = Path(__file__).resolve().parents[1]
SOURCES = REPO / "scripts" / "festival-lineups"
OUT = REPO / "src" / "frontend" / "public" / "music-festivals"


def iso(dt: datetime, offset_seconds: int) -> str:
    """ISO-8601 with the festival's own offset in the string (the app's `isoString`)."""
    sign = "-" if offset_seconds < 0 else "+"
    a = abs(offset_seconds)
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + f"{sign}{a // 3600:02d}:{(a % 3600) // 60:02d}"


def local_datetime(day: date, hhmm: str) -> datetime:
    """A festival-local set time on `day`. Hours before the 06:00 rollover land on day+1."""
    h, m = (int(p) for p in hhmm.split(":"))
    d = day + timedelta(days=1) if h < ROLLOVER_HOUR else day
    return datetime.combine(d, time(h, m))


def build_pack(source: dict) -> tuple[dict, dict]:
    """Source lineup → (wire JSON object, manifest entry). Raises on anything the
    app's validator would reject — a pack must never publish broken."""
    offset = int(source["utcOffsetSeconds"])
    if not (-12 * 3600 <= offset <= 14 * 3600):
        raise ValueError(f"{source['id']}: utcOffsetSeconds {offset} is not a real-world offset")

    start_date = date.fromisoformat(source["startDate"])
    end_date = date.fromisoformat(source["endDate"])
    seen_days: set[str] = set()
    days_out = []
    stage_count = 0
    set_count = 0

    for day in source["days"]:
        day_date = date.fromisoformat(day["date"])
        if day["date"] in seen_days:
            raise ValueError(f"{source['id']}: duplicate day {day['date']}")
        seen_days.add(day["date"])
        if not (start_date <= day_date <= end_date):
            raise ValueError(f"{source['id']}: day {day['date']} outside the festival dates")
        window_start = datetime.combine(day_date, time(ROLLOVER_HOUR))
        window_end = window_start + timedelta(hours=24)
        if not day["stages"]:
            raise ValueError(f"{source['id']}: day {day['date']} has no stages")

        stages_out = []
        for stage in day["stages"]:
            stage_count += 1
            if not stage["sets"]:
                raise ValueError(f"{source['id']}: '{stage['name']}' on {day['date']} has no sets")
            sets_out = []
            for artist, start_hhmm, end_hhmm in stage["sets"]:
                set_count += 1
                if not artist.strip():
                    raise ValueError(f"{source['id']}: empty artist on '{stage['name']}' {day['date']}")
                start = local_datetime(day_date, start_hhmm)
                end = local_datetime(day_date, end_hhmm)
                if end <= start:
                    raise ValueError(f"{source['id']}: '{artist}' window {start_hhmm}–{end_hhmm} is inverted")
                if not (window_start <= start and end <= window_end):
                    raise ValueError(f"{source['id']}: '{artist}' falls outside the {day['date']} "
                                     f"day window (06:00 → 06:00 next morning)")
                sets_out.append({"artist": artist, "start": iso(start, offset), "end": iso(end, offset)})
            ordered = sorted(sets_out, key=lambda s: s["start"])
            for a, b in zip(ordered, ordered[1:]):
                if b["start"] < a["end"]:
                    raise ValueError(f"{source['id']}: '{a['artist']}' and '{b['artist']}' overlap "
                                     f"on '{stage['name']}' ({day['date']})")
            stages_out.append({"name": stage["name"], "sets": sets_out})
        days_out.append({"date": day["date"], "stages": stages_out})

    wire = {
        "formatVersion": FORMAT_VERSION,
        "id": source["id"],
        "name": source["name"],
        "location": source["location"],
        "startDate": source["startDate"],
        "endDate": source["endDate"],
        "utcOffsetSeconds": offset,
        "days": days_out,
    }
    entry = {
        "id": source["id"],
        "name": source["name"],
        "location": source["location"],
        "startDate": source["startDate"],
        "endDate": source["endDate"],
        "file": f"{source['id']}.fpack",
        "stages": stage_count,
        "sets": set_count,
        "updatedAt": source.get("updated", ""),
    }
    return wire, entry


def encode_fpack(wire: dict) -> bytes:
    """JSON → "FPAK" + version byte + raw DEFLATE. Sorted keys + compact separators →
    the same source always yields the same bytes (reproducible packs)."""
    payload = json.dumps(wire, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    compressor = zlib.compressobj(9, zlib.DEFLATED, -15)  # wbits=-15 → RAW deflate
    deflated = compressor.compress(payload) + compressor.flush()
    return MAGIC + bytes([FORMAT_VERSION]) + deflated


def self_check(blob: bytes, wire: dict) -> None:
    """Round-trip the freshly-built pack exactly the way the app decodes it."""
    assert blob[:4] == MAGIC, "magic missing"
    assert blob[4] == FORMAT_VERSION, "version byte wrong"
    inflated = zlib.decompressobj(-15).decompress(blob[5:])
    assert json.loads(inflated.decode("utf-8")) == wire, "round-trip mismatch"


def main() -> None:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for path in sorted(SOURCES.glob("*.json")):
        source = json.loads(path.read_text())
        wire, entry = build_pack(source)
        if not only or source["id"] in only:
            blob = encode_fpack(wire)
            self_check(blob, wire)
            out = OUT / entry["file"]
            out.write_bytes(blob)
            print(f"built {out.relative_to(REPO)}  ({len(blob):,} bytes · "
                  f"{entry['stages']} stages · {entry['sets']} sets)")
        entry["sizeBytes"] = (OUT / entry["file"]).stat().st_size
        entries.append(entry)

    manifest = {"generatedAt": max((e["updatedAt"] for e in entries), default=""),
                "festivals": entries}
    manifest_path = OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {manifest_path.relative_to(REPO)}  ({len(entries)} festivals)")


if __name__ == "__main__":
    main()
