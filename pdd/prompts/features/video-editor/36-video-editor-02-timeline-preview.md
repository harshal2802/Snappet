# Prompt: Video Editor — M2 Timeline + Preview

**File**: pdd/prompts/features/video-editor/36-video-editor-02-timeline-preview.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Source**: GitHub issue #48 + PLAN-video-editor.md (Phase M2)
**Depends on**: M1 (35-video-editor-01-foundation.md)

## Context

Building on M1's Media Bin, this phase adds the **single-track timeline and WebGL2 preview**.
A user can drag a clip from the bin onto the timeline, scrub the playhead, see the frame
in the preview canvas, trim a clip via its edge handles, split at the playhead, and delete
the selection.

Audio playback during preview is intentionally **omitted in v1** — preview is video-only.
Audio is mixed and rendered correctly at export (M3). This is a documented trade-off:
implementing real-time audio scrub adds significant complexity (WebAudio + decoded chunk
scheduling) without altering the final exported output's quality.

## Task

Implement a working timeline + preview pane such that a user can edit and watch a single
video track and see what their export will look like (visually).

## Output format

### 1. `src/frontend/apps/video-editor/state/editorStore.ts` (extend M1)

Add to the Zustand store:

```ts
interface EditorState {
  // ... M1 fields
  project: Project;
  selection: { kind: 'clip'; id: ClipId } | null;
  playhead: number;          // seconds
  isPlaying: boolean;
  zoomPxPerSec: number;      // timeline scale (default 100)

  // actions
  addClipFromAsset(assetId: AssetId, trackId?: TrackId): void;
  moveClip(id: ClipId, newStartSec: number): void;
  trimClip(id: ClipId, edge: 'in'|'out', newSec: number): void;
  splitClipAtPlayhead(): void;
  deleteSelection(): void;
  setPlayhead(sec: number): void;
  play(): void;
  pause(): void;
  setZoom(pxPerSec: number): void;
}
```

Initial `project` on first mount:
- One video track (`kind: 'video'`, `index: 0`)
- One audio track (`kind: 'audio'`, `index: 0`)
- Empty `clips`
- `fps: 30, width: 1920, height: 1080`

Persist `project` to OPFS at `project/project.json` after mutations (debounce 300ms).

### 2. `src/frontend/apps/video-editor/state/selectors.ts`

```ts
export const clipsAtTime = (project: Project, time: number, trackKind?: Track['kind']): Clip[];
export const totalDurationSec = (project: Project): number;
export const sourceTimeForClip = (clip: Clip, time: number): number;
```

`sourceTimeForClip` returns `clip.inSec + (time - clip.startSec)` — used by the renderer.

### 3. `src/frontend/apps/video-editor/timeline/Timeline.tsx`

Layout:
- Top: `<Ruler />` (time labels every 1s at default zoom)
- Middle: vertical stack of `<Track />` rows (video first, audio below)
- Overlay: `<Playhead />` (absolutely positioned vertical line spanning all rows)
- Horizontal scroll container; clicking empty space sets playhead; cmd-scroll zooms

### 4. `src/frontend/apps/video-editor/timeline/Track.tsx`

A single row showing all clips that belong to this track. Each clip is a `<Clip />`.

### 5. `src/frontend/apps/video-editor/timeline/Clip.tsx`

Clickable, draggable block. Width = `(outSec - inSec) * zoomPxPerSec`. Background shows
the asset thumbnail tiled or stretched. Three drag zones:
- **In handle** (left 8px): drag → `trimClip(id, 'in', ...)` (clamps to asset start)
- **Out handle** (right 8px): drag → `trimClip(id, 'out', ...)` (clamps to asset end)
- **Body**: drag → `moveClip(id, ...)` (clamps to ≥0; snap to neighbor edges within 6px)

Use `useTimelineDrag` (custom hook). Touch + mouse both supported.

### 6. `src/frontend/apps/video-editor/timeline/Ruler.tsx`

Tick marks every 1s; labels at 5s intervals at default zoom. Auto-adjusts at extreme
zooms (every 100ms at high zoom; every 10s at low zoom).

### 7. `src/frontend/apps/video-editor/timeline/Playhead.tsx`

Absolute-positioned vertical line; draggable via its handle. Drag updates `playhead`.

### 8. `src/frontend/apps/video-editor/timeline/useTimelineDrag.ts`

Custom hook unifying pointer events (mouse + touch) into `{ onPointerDown, onPointerMove,
onPointerUp }` with `dx` in seconds (already divided by `zoomPxPerSec`). Captures pointer
to make drags work even when the cursor leaves the element.

### 9. `src/frontend/apps/video-editor/preview/PreviewCanvas.tsx`

`<canvas width={project.width} height={project.height}>` with WebGL2 context.
Resizes via CSS `object-fit: contain` to fit its container. Owns a `Renderer` instance
that runs while `isPlaying === true` AND on every `playhead` change while paused.

### 10. `src/frontend/apps/video-editor/preview/Renderer.ts`

Class with constructor `(gl: WebGL2RenderingContext, getState: () => EditorState)`.

```ts
class Renderer {
  private rafId: number | null = null;
  private decoderPool: DecoderPool;
  private compositor: Compositor;
  private lastClockTime = 0;
  private lastTimelineTime = 0;

  start(): void;       // begin rAF loop
  stop(): void;        // cancel rAF
  renderOnce(): void;  // one-shot for paused-scrub
  dispose(): void;     // close GPU resources
}
```

Loop:
1. If playing: advance `state.playhead` by `(now - lastClockTime)` seconds (capped to avoid
   huge jumps after a tab background).
2. Resolve clips at `state.playhead` for the video track (M2: one track).
3. If no clip: clear canvas to black.
4. Else: `const frame = await decoderPool.getFrame(clip.assetId, sourceTimeForClip(clip, t));`
   then `compositor.draw(frame, clip.transform)`, then `frame.close()`.
5. If `playhead >= totalDuration` and playing: pause.

### 11. `src/frontend/apps/video-editor/preview/DecoderPool.ts`

Maintains a Map<AssetId, DecoderEntry>. Each entry owns:
- a `VideoDecoder`
- a small ring buffer of decoded `VideoFrame`s (capacity 12)
- a `keyframeIndex: number[]` (decode-time keyframe timestamps)

API:
```ts
class DecoderPool {
  constructor(opfsRead: (path: string) => Promise<Blob>) {}
  async getFrame(assetId: AssetId, sourceTimeSec: number): Promise<VideoFrame>;
  release(assetId: AssetId): void;
  disposeAll(): void;
}
```

Behavior:
- On first `getFrame(assetId, t)`: lazy-load the proxy blob from OPFS, demux with mp4box,
  build keyframe index, init VideoDecoder.
- On request: find the requested frame in the ring buffer. If hit → return clone, advance.
- Cache miss: seek decoder by feeding from the nearest keyframe ≤ t, drop frames until
  the closest one to `t` is decoded; return it; continue decoding the next ~6 frames into
  the buffer.
- LRU eviction: at most 3 active decoders at once. Closing a decoder must close all its
  buffered frames first.

CRITICAL: callers of `getFrame` MUST call `frame.close()` after `draw`. The pool returns
freshly-cloned `VideoFrame`s (via `frame.clone()`) so eviction is safe.

### 12. `src/frontend/apps/video-editor/preview/Compositor.ts`

Minimal WebGL2 pipeline: single passthrough shader that draws a textured quad. `draw(frame,
transform?)` uploads the `VideoFrame` as a texture (`gl.texImage2D(..., frame)`) and renders
to the default framebuffer.

In M2, `transform` is identity (centered, contain). M4 will add scale/translate/rotate.

### 13. `src/frontend/apps/video-editor/ui/Toolbar.tsx`

Buttons (top of editor):
- **Split** (cuts the selected clip — or all clips — at playhead)
- **Delete** (deletes selection)
- **Zoom −** / **Zoom +**
- Right side: hint "Export coming in M3" (will be replaced in M3 with a real Export button)

### 14. `src/frontend/apps/video-editor/ui/Transport.tsx`

Below the preview canvas:
- Play/Pause toggle (space bar shortcut)
- Time readout `00:03.500 / 00:34.000`
- Skip-to-start / skip-to-end buttons
- Click "P" hint for play

### 15. `src/frontend/apps/video-editor/ui/Inspector.tsx`

Right-side panel showing the selected clip's properties (read-only in M2 except start/in/out
which are shown but only editable via timeline drag):
- Asset name
- Start: 0.000s
- In: 0.000s
- Out: 5.000s
- Duration: 5.000s

### 16. `src/frontend/apps/video-editor/ui/MediaBin.tsx` (extend M1)

Each card gets two interactions in M2:
- Double-click → `addClipFromAsset(assetId)` (appends at the end of the video track)
- Drag → drop onto Timeline → adds at the drop position (snap to playhead within 6px)

### 17. `src/frontend/apps/video-editor/index.tsx` (restructure)

New layout:

```
┌─────────────────────────────────────────────────┐
│ Header                                          │
├─────────────────────┬───────────────────────────┤
│ MediaBin            │ PreviewCanvas             │
│                     │ Transport                 │
│                     │ Inspector                 │
├─────────────────────┴───────────────────────────┤
│ Toolbar                                         │
│ Timeline (Ruler / Tracks / Playhead)            │
└─────────────────────────────────────────────────┘
```

Responsive: on `< md` (mobile), stack vertically. Timeline is always horizontally scrollable.

## Acceptance criteria

- [ ] Dropping/double-clicking a Media Bin asset adds a clip to the video track
- [ ] Dragging a clip moves it; trim handles work; clips can't go negative or beyond asset bounds
- [ ] Split at playhead works (selected clip becomes two; both retain asset reference)
- [ ] Delete removes the selected clip
- [ ] Play advances the playhead and updates the preview at ~30fps
- [ ] Space bar toggles play/pause
- [ ] Scrubbing the playhead repaints the preview to the correct frame
- [ ] Zoom in/out changes the time scale; ruler labels stay readable
- [ ] No `VideoFrame` leak warnings in DevTools after 60s of scrubbing
- [ ] Project state survives a reload (clips re-list; assets may be "missing" → re-link)
- [ ] `tsc --noEmit` clean
- [ ] Dark mode supported

## Constraints

- TS strict; no `any`
- Tailwind only; no inline styles except for dynamic widths/positions (`style={{ left: ... }}`)
- Audio is intentionally silent in preview — do not add a WebAudio scheduler in M2
- DecoderPool MUST cap concurrent decoders (default: 3) to avoid GPU/CPU starvation
- All `VideoFrame.close()` paired with its consumer in `try/finally`
- M3's export module does not exist yet — do not import from `../export/`
- Reuse `useLocalStorage` only for tiny UI prefs (e.g. zoom level); project lives in OPFS
