# Research: Professional video-editor features (CapCut-free / Instagram Edits) — browser feasibility

**Date**: 2026-05-28
**For**: Video editor mini-app — "make it feel professional" (full player + smoother editing + CapCut/Edits-style features)
**Method**: Two parallel web-research passes (feature taxonomy; client-side WebCodecs feasibility).

## Prioritized feature set (what makes it "feel pro")

### Tier 1 — must-have (absence reads as "toy")
- **Player**: large frame-accurate preview; play/pause (button + Space); scrubbable progress
  bar with live frame while dragging; time display (`mm:ss.cs`); **frame-step** (←/→) — the
  single biggest "pro" signal; volume + mute; **fullscreen** (button + `F`); loading state.
- **Timeline**: multi-track (video + audio + overlay/text); trim; split at playhead (`S`);
  move/reorder; select+delete; **zoom in/out**; **snapping** to playhead/edges/start;
  **undo/redo** (`Cmd/Ctrl+Z`, `Shift+…`).
- **Canvas/output**: **aspect-ratio presets** 9:16, 16:9, 1:1, 4:5, 4:3; watermark-free export.
- **Text overlays**; **background music / audio track**; **per-clip volume**.

### Tier 2 — high-value (decent → pro-grade; all free in CapCut/Edits)
- Player: playback-speed selector (0.5/1/1.5/2); auto-hide controls; full keyboard set
  (Space/K, J/L shuttle, arrows step, Home/End); loop toggle.
- Editing: **per-clip speed** (+ ramp presets); **transitions** (Fade, Black Fade, slide, zoom,
  blur); **filters** (one-tap looks + intensity); **adjustments** (brightness/contrast/
  saturation/exposure/temperature/sharpen); **keyframe animation** (pos/scale/rot/opacity);
  **PiP/overlay clips**; blurred-fill background for off-ratio clips; **beat snapping**.
- Captions/assets: auto-captions; stickers/emoji; audio extraction; audio fade in/out.

### Tier 3 — nice-to-have
- Masks (shape + feather + invert); chroma key; duplicate/copy-paste (`Cmd/Ctrl+D`);
  fit-to-window zoom; templates; filmstrip thumbnails on clips; canvas alignment guides.

### Explicitly premium in CapCut (skip)
- 4K export, faster render queue, cloud; premium templates/fonts/music; advanced AI
  (motion tracking, vocal isolation, AI avatars, unlimited auto-captions/auto-edit).

## Client-side feasibility & techniques (the load-bearing decisions)

1. **Architecture spine**: ONE WebGL2 single-pass composite for video + color/LUT +
   transitions (two-texture `mix`) + overlays (2D-canvas→texture). Same composite path for
   preview AND export (WYSIWYG). Canonical "stage" coordinate system = export resolution;
   preview is a CSS-scaled view. Overlay coords in normalized 0–1 space so preview == export.
2. **Fullscreen**: Fullscreen API on the wrapper `<div>` for desktop/Android/iPadOS. **iPhone
   Safari has no element fullscreen** (only `video.webkitEnterFullscreen`, which hides
   canvas overlays) → use **CSS pseudo-fullscreen** (`position:fixed; inset:0; 100dvh`,
   lock body scroll). Handle `fullscreenchange`/`webkitfullscreenchange`. Trigger from gesture.
3. **Audio preview**: prefer **Web Audio** (`AudioContext` + `AudioBufferSourceNode`) over
   `<audio>` elements (coarse seeking/drift). `decodeAudioData` per source once (cache by
   asset). `AudioContext` starts suspended → `resume()` on user gesture. Source nodes are
   one-shot: recreate on each play/seek. For export use `OfflineAudioContext` (already done).
4. **Color/filters**: upload `VideoFrame` as texture, **close() immediately**. Brightness
   `c*b`; contrast `(c-.5)*k+.5`; saturation `mix(luma, c, s)` (luma 0.2126/0.7152/0.0722).
   Preset "looks" via uniform tints / curves (LUT PNG optional later). Keep to one pass.
5. **Transitions**: during overlap decode both clips for the same timeline t, two textures,
   `mix(a,b,smoothstep(t))`; fade-to-black = mix vs `vec3(0)`. Two decoders during overlap.
6. **Overlays (text/image)**: rasterize text via Canvas2D `fillText` → texture (cache; only
   re-raster on change). `document.fonts.ready` before raster. Rasterize at export res so it
   isn't blurry. Draw quads after video with alpha blending.
7. **Speed**: resample on the timeline (fetch source frame at `clipStart+(T-place)*speed`),
   not by dropping frames at decode. Audio: `playbackRate` (pitch-shifts) — acceptable for v1.
8. **Aspect presets**: target canvas = preset pixels (e.g. 1080×1920). Per-clip transform
   `{scale,translate,rotate}` for contain (letterbox) vs cover (crop). Blurred-fill = a second
   downscaled+blurred pass (extra GPU). Respect source display matrix (rotation) from mp4box.
9. **Undo/redo**: `zundo` `temporal` middleware with strict **`partialize`** — track only the
   serializable document model (clips/tracks/overlays/filters/order). Keep `File`/`VideoFrame`/
   decoders/`Map`s OUT of history. Group rapid drags into one entry; `limit` history depth.
10. **Perf on mid mobile (where editors die)**: `VideoFrame.close()` always; cap concurrent
    decoders (~1–2); reuse textures (no per-frame `createTexture`); proxy-edit; check
    `navigator.storage.estimate()` + `persist()`; export in a Worker w/ OffscreenCanvas.

**Known gap**: Firefox **Android** still lacks `VideoDecoder` → keep the capability gate +
unsupported screen (already implemented).

## Decision for this chain
Build a professional **player + fullscreen** first (explicit ask), then the WYSIWYG
**WebGL composite pipeline** (aspect ratios + adjustments/filters + overlays + transitions),
**per-clip speed**, **audio preview**, and **smoother editing** (undo/redo, snapping,
duplicate, fit-zoom, full shortcuts). All client-side; no new heavy deps beyond `zundo`.
Sources captured inline in the two research passes (CapCut help docs, Meta Edits guides,
MDN WebCodecs/Web Audio, caniuse, zundo).
