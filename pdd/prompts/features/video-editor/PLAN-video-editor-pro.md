# Implementation Plan: Video Editor — Professional upgrade

**Created**: 2026-05-28
**Complexity**: High
**Builds on**: M1–M3 MVP (#48/#49) + hardening (#50). Research:
`pdd/context/research/video-editor-pro-features.md`.

## Goal
Make the editor "feel professional": a complete fullscreen video player, a WYSIWYG WebGL
composite pipeline (aspect ratios, adjustments/filters, text/image overlays, transitions),
per-clip speed, audio preview, and smoother editing (undo/redo, snapping, duplicate, fit
zoom, full keyboard shortcuts). 100% client-side. One feature branch, committed per phase,
build green at every commit, deployed via PR → main → GitHub Pages.

## Architecture changes (spine)
- **Document model becomes richer + serializable**: `Clip` gains `speed`, `filters`
  (brightness/contrast/saturation + preset look + intensity), `fit` (contain/cover),
  per-clip `transform`. New `TextOverlay` model on an overlay track. `Project` gains
  `aspectRatio` preset. Transition stored on a clip's leading edge.
- **WebGL Compositor rewritten** to a parameterized single pass: video texture + adjustment
  uniforms + optional second texture for transitions + overlay quads (text/image textures).
  Same module used by preview Renderer AND export pipeline.
- **Undo/redo** via `zundo` temporal middleware with `partialize` over the document model
  only (assets/sourceFiles/UI excluded).

## Phases (each = one commit, build-green)
- **P1 — Pro player + fullscreen**: `ui/Player.tsx` chrome around `PreviewCanvas`
  (play/pause, scrub, time, volume/mute, speed, loop, fullscreen w/ iOS CSS fallback,
  auto-hide, full keyboard incl. frame-step). Renderer gains speed/loop awareness.
- **P2 — Aspect ratios + adjustments/filters**: `Project.aspectRatio`; ratio picker;
  Compositor adjustment uniforms + preset looks; Inspector sliders; export honors them.
- **P3 — Audio preview**: Web Audio engine (`preview/AudioEngine.ts`) decoding sources to
  AudioBuffers, scheduled on play, synced to playhead; volume/mute wired.
- **P4 — Text overlays**: `TextOverlay` model + overlay track + canvas-rasterized texture
  composited in preview & export; Inspector editor (text/size/color/position/timing).
- **P5 — Per-clip speed + transitions**: speed resampling on timeline (preview+export);
  crossfade + fade-to-black between adjacent clips.
- **P6 — Smoother editing**: undo/redo (zundo), snapping w/ guide, duplicate (`Cmd/Ctrl+D`),
  ripple delete, fit-to-window zoom, expanded shortcuts.

## Risks
- Audio/video preview drift — accept minor drift in v1 (rAF playhead; audio started at offset).
- Two-decoder transitions cost memory on mobile — keep transition durations short, reuse pool.
- iOS fullscreen — CSS pseudo-fullscreen keeps canvas overlays visible.
- zundo + non-serializable state — strict `partialize`.

## Status
- P1–P6 — in progress (this chain). Deferred to later: keyframe animation, beat snapping,
  auto-captions, masks, chroma key, templates, filmstrip thumbnails, blurred-fill background.
