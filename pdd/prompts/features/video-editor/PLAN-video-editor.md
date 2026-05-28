# Implementation Plan: Video Editor

**Created**: 2026-05-28
**Complexity**: High
**Estimated prompts**: 5 (M1–M5); MVP after M3

## Summary

Build a browser-only, CapCut-style video editor mini-app at `/video-editor`. Scoped in
GitHub issue [#48](https://github.com/harshal2802/Snappet/issues/48). React 18 + TS + Tailwind
(all present), plus new deps: `zustand`, `mp4box`, `mp4-muxer`.

**Strict constraints** (per issue + user confirmation):

- Client-side only. No server, no upload, no analytics.
- WebCodecs-first. No `ffmpeg.wasm` fallback in v1 — graceful "unsupported browser" screen
  for the rest. Targets Chrome/Edge 94+, Safari 17+, Firefox 130+.
- Read media via `<input type="file">` + drag-drop. Write via `navigator.share`
  (mobile first-class) → `showSaveFilePicker` (desktop Chromium) → `<a download>` fallback.
- iOS Live Photos: read MOV portion only; do not attempt to write a Live Photo back
  (Apple-private metadata).
- Proxy strategy: source → 720p H.264 in OPFS for editing; export against the original.
- PWA-installable (existing `vite-plugin-pwa` already wired). Manifest `file_handlers` /
  `share_target` are desktop/Android-only and can be wired in M4+; v1 doesn't depend on them.

## Phases

### M1 — Foundation: ingest + proxy + media bin

**Produces**:
- `src/frontend/apps/video-editor/index.tsx` — default export, app shell
- `src/frontend/apps/video-editor/types/{timeline,codec}.ts` — Project/Track/Clip/MediaAsset
- `src/frontend/apps/video-editor/support/caps.ts` — feature detection (WebCodecs / OPFS / Share)
- `src/frontend/apps/video-editor/support/UnsupportedBrowser.tsx` — fallback screen
- `src/frontend/apps/video-editor/media/opfs.ts` — OPFS read/write helpers
- `src/frontend/apps/video-editor/media/ingest.ts` — File → MediaAsset (probe via mp4box.js)
- `src/frontend/apps/video-editor/media/proxy.ts` — spawns proxy worker
- `src/frontend/apps/video-editor/workers/proxy.worker.ts` — decode src → re-encode 720p H.264 → OPFS
- `src/frontend/apps/video-editor/state/editorStore.ts` — Zustand: assets, ingest progress
- `src/frontend/apps/video-editor/ui/MediaBin.tsx` — list imported assets with thumbnails + status
- `src/frontend/apps/video-editor/ui/Dropzone.tsx` — file input + drag-drop entry
- `src/frontend/router/routes.tsx` — add `/video-editor` (category: Creative, icon: 🎬)
- `package.json` — add `zustand`, `mp4box`, `mp4-muxer`

**Depends on**: nothing (clean addition)

**Risk**: Medium — WebCodecs + Worker + OPFS interplay needs care. Mitigated by isolating
all decode work in the worker; main thread only orchestrates.

**Prompt**: `pdd/prompts/features/video-editor/35-video-editor-01-foundation.md`

---

### M2 — Single-track editing + WebGL preview

**Produces**:
- `src/frontend/apps/video-editor/state/editorStore.ts` (extended) — project, clips, playhead
- `src/frontend/apps/video-editor/state/selectors.ts` — `clipsAtTime`, `durationSec`
- `src/frontend/apps/video-editor/timeline/{Timeline,Track,Clip,Ruler,Playhead}.tsx`
- `src/frontend/apps/video-editor/timeline/useTimelineDrag.ts` — drag/trim handles (no @dnd-kit; mouse+touch native)
- `src/frontend/apps/video-editor/preview/PreviewCanvas.tsx` — `<canvas>` + WebGL2
- `src/frontend/apps/video-editor/preview/Renderer.ts` — rAF loop
- `src/frontend/apps/video-editor/preview/Compositor.ts` — draw frames with transform
- `src/frontend/apps/video-editor/preview/DecoderPool.ts` — VideoDecoder pool, LRU, frame buffer
- `src/frontend/apps/video-editor/ui/{Toolbar,Inspector,Transport}.tsx` — controls
- Add clips by dropping/double-clicking in MediaBin → appends to track 1 at playhead

**Depends on**: M1

**Risk**: High — preview render loop + DecoderPool is the technically hardest piece.
Hidden hazards: `VideoFrame` GC leaks, seek-to-keyframe correctness, audio scrub
(audio playback during scrub is omitted in v1 — preview is video only; full audio happens at export).

**Prompt**: `pdd/prompts/features/video-editor/36-video-editor-02-timeline-preview.md`

---

### M3 — Export

**Produces**:
- `src/frontend/apps/video-editor/export/exportPipeline.ts` — frame-by-frame orchestrator
- `src/frontend/apps/video-editor/export/videoMuxer.ts` — `mp4-muxer` wrapper
- `src/frontend/apps/video-editor/export/audioMixer.ts` — `OfflineAudioContext` + `AudioEncoder`
- `src/frontend/apps/video-editor/workers/encoder.worker.ts` — VideoEncoder off main thread
- `src/frontend/apps/video-editor/media/share.ts` — `navigator.share` / `showSaveFilePicker` / download dispatcher
- `src/frontend/apps/video-editor/ui/ExportDialog.tsx` — preset picker (720p/1080p), progress bar, cancel
- Wire **Export** button in Toolbar

**Depends on**: M1 + M2

**Risk**: Medium-High — main hazards: timestamp arithmetic (us-precision throughout),
encoder back-pressure, memory pressure on long timelines. Mitigation: stream
frame-by-frame; never hold >2 `VideoFrame`s; explicit `.close()` with try/finally.

**Prompt**: `pdd/prompts/features/video-editor/37-video-editor-03-export.md`

---

### M4 — Multi-track + overlays (deferred — separate PR)

Image overlays, text overlays, N video tracks with z-order compositing, per-clip volume.

**Prompt**: `pdd/prompts/features/video-editor/38-video-editor-04-multi-track.md` (later)

### M5 — Transitions & effects (deferred — separate PR)

Crossfade, dip-to-black, LUT/filter pass, speed ramp.

**Prompt**: `pdd/prompts/features/video-editor/39-video-editor-05-effects.md` (later)

---

## Bundle into one PR vs split per phase?

The Snappet convention is one PR per phase (workout chain, doc-viewer chain).
**This chain ships M1+M2+M3 in a single PR** because:

1. The three phases are tightly coupled — M1 alone is a media inspector with no editing;
   M2 alone has no way to get a usable result out. Only M1+M2+M3 together produce a
   shippable "video editor" mini-app users can actually test.
2. Each phase is committed separately within the PR so the diff is reviewable in chunks.
3. M4 and M5 are genuinely additive layers and will follow as their own PRs.

## Risks & Unknowns

- **WebCodecs adoption gap.** Firefox shipped `VideoDecoder`/`VideoEncoder` in 130 (Oct 2024).
  Older Firefox + all of iOS <17 see the unsupported screen. No fallback in v1 by design.
- **Hardware decode variance.** A 4K HEVC clip that decodes at 60fps on M-series Mac may
  stall a mid-range Android. Proxy mitigates editing; export will simply be slower on
  weaker devices — surface a progress UI and elapsed-time readout.
- **OPFS quota on iOS PWA.** ~50% of free disk but evicted aggressively. M1 stores proxies;
  worst case a re-ingest is needed if eviction happens. Acceptable for v1.
- **Audio decode** in v1 export path uses Web Audio's `decodeAudioData` on the original
  audio bytes (clean, supported everywhere). `AudioDecoder` via WebCodecs is a possible
  optimization later but adds complexity without a clear v1 win.
- **No Vitest config in repo yet.** Mini-apps so far have no co-located tests. v1 ships
  without tests; we rely on typecheck (`tsc`) + manual browser smoke. Adding a test
  harness is a separate cross-cutting PR.
- **mp4box.js types.** Ships TS types of varying quality; expect some `// @ts-expect-error`
  or thin local `declare` shims rather than fighting upstream defs.

## Decisions Needed

None pending — issue #48 + this turn's exchange locked all major decisions:

- Strictly client-side: yes
- WebCodecs-first, no fallback: yes
- Gallery I/O via Share + filepicker + download: yes
- Live Photo round-trip: out of scope
- Proxy strategy: 720p H.264 in OPFS
- Bundle M1–M3 into one MVP PR: this plan

## Status

- M1 — in progress (this PR)
- M2 — in progress (this PR)
- M3 — in progress (this PR)
- M4 — deferred (future PR)
- M5 — deferred (future PR)
