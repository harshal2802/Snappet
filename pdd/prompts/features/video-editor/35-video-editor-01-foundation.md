# Prompt: Video Editor — M1 Foundation (ingest, proxy, media bin)

**File**: pdd/prompts/features/video-editor/35-video-editor-01-foundation.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Source**: GitHub issue #48 + PLAN-video-editor.md (Phase M1)
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md, pdd/prompts/features/pwa/17-pwa-support.md

## Context

Snappet is a hub of lightweight React + Vite mini-apps, installable as a PWA. This is **Phase M1
of the browser-only video editor** at `/video-editor`. M1 ships the foundation: the app shell,
feature detection, file ingest, the proxy worker (decode source → re-encode to 720p H.264 in
OPFS), and a Media Bin showing imported clips with their thumbnails and ingest progress.

This phase is NOT yet editable — no timeline, no preview. It proves the hardest plumbing
(WebCodecs + Worker + OPFS) works end-to-end before M2 layers a timeline on top.

**Stack**: React 18, TypeScript strict, Tailwind, Vite. **New deps**: `zustand` (editor store),
`mp4box` (demux), `mp4-muxer` (used in M3 — install now to avoid two `npm install` rounds).

## Task

Implement everything needed for a user to:

1. Open `/video-editor`.
2. See the unsupported-browser screen if WebCodecs / OPFS / Worker are missing.
3. Drag a video file onto the dropzone (or click to file-pick).
4. Watch a per-asset progress bar as the proxy is generated in a worker.
5. See the asset appear in a Media Bin with: filename, duration, resolution, thumbnail.
6. Reload the page and (gracefully) see assets re-listed from OPFS, with a "media missing —
   re-link" prompt because the original `File` object did not survive (iOS does not give us
   persistent file handles).

## Output format

### 1. `package.json` — new deps

```jsonc
{
  "dependencies": {
    // existing ...
    "zustand": "^4.5.0",
    "mp4box": "^0.5.2",
    "mp4-muxer": "^5.1.5"
  }
}
```

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/video-editor',
  label: 'Video Editor',
  description: 'Browser-only video editor — trim, sequence, and export. Strictly client-side.',
  category: 'Creative',
  icon: '🎬',
  component: lazy(() => import('../apps/video-editor')),
},
```

### 3. `src/frontend/apps/video-editor/types/timeline.ts`

```ts
export type ClipId = string;
export type TrackId = string;
export type AssetId = string;

export type AssetStatus = 'ingesting' | 'ready' | 'error' | 'missing';

export interface MediaAsset {
  id: AssetId;
  name: string;
  kind: 'video' | 'image' | 'audio';
  mimeType: string;
  sourceBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  proxyPath?: string;        // OPFS path (e.g. 'proxies/<id>.mp4')
  thumbnailDataUrl?: string; // tiny JPEG/PNG
  status: AssetStatus;
  ingestProgress?: number;   // 0..1
  errorMessage?: string;
}

export interface Transform {
  x: number; y: number;
  scaleX: number; scaleY: number;
  rotation: number;
  opacity: number;
}

export interface Clip {
  id: ClipId;
  assetId: AssetId;
  trackId: TrackId;
  startSec: number;
  inSec: number;
  outSec: number;
  transform?: Transform;
  volume?: number;
}

export interface Track {
  id: TrackId;
  kind: 'video' | 'audio' | 'overlay';
  index: number;
  muted: boolean;
}

export interface Project {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  tracks: Track[];
  clips: Record<ClipId, Clip>;
}

export const PROJECT_DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const;
```

### 4. `src/frontend/apps/video-editor/support/caps.ts`

Feature-detect once, cache the result, expose helpers.

```ts
export interface Capabilities {
  webCodecs: boolean;
  videoDecoder: boolean;
  videoEncoder: boolean;
  audioDecoder: boolean;
  audioEncoder: boolean;
  opfs: boolean;
  worker: boolean;
  share: boolean;
  shareFiles: boolean;
  fileSystemAccess: boolean;
}

export function detectCapabilities(): Capabilities { /* ... */ }
export function isEditorSupported(c: Capabilities): boolean {
  // VideoDecoder + VideoEncoder + OPFS + Worker
  return c.videoDecoder && c.videoEncoder && c.opfs && c.worker;
}
```

`canShareFiles` test must use `navigator.canShare?.({ files: [...] })` with a dummy `File`.

### 5. `src/frontend/apps/video-editor/support/UnsupportedBrowser.tsx`

Show a friendly screen explaining what's missing, with a list of supported browsers and
versions. Dark mode supported, matches the visual language of other mini-apps.

### 6. `src/frontend/apps/video-editor/media/opfs.ts`

Helpers around `navigator.storage.getDirectory()`:
- `getOpfsRoot()`
- `ensureDir(path: string)` (creates nested dirs)
- `writeFile(path: string, data: Uint8Array | Blob | ReadableStream)`
- `readFile(path: string): Promise<Blob>`
- `deleteFile(path: string)`
- `listFiles(dir: string)`
- `estimateQuota()` → `{ used, quota, percentUsed }`

All file paths are POSIX-style (`'proxies/abc.mp4'`).

### 7. `src/frontend/apps/video-editor/media/ingest.ts`

`ingestFile(file: File): Promise<MediaAsset>` (synchronously creates the asset with
`status: 'ingesting'` and triggers the worker; resolves when the asset has core metadata —
durationSec, width, height, fps, hasAudio).

Uses `mp4box.js` to probe the source: feed source bytes to `MP4Box.createFile()`,
listen to `onReady` for `info: { duration, timescale, videoTracks[0], audioTracks[0] }`.
Compute `durationSec = info.duration / info.timescale`. For `width/height/fps`, read from
the first video track. For `hasAudio`, check `audioTracks.length > 0`.

For non-MP4/MOV containers, fall back to a `<video>` probe (`onloadedmetadata`).

### 8. `src/frontend/apps/video-editor/workers/proxy.worker.ts`

A dedicated worker that:

1. Receives `{ assetId, file, targetWidth: 1280, targetHeight: 720, targetBitrate: 2_500_000 }`.
2. Uses `MP4Box` to demux the source into encoded video chunks (works for .mp4 / .mov).
3. Pipes chunks through `VideoDecoder` → `VideoFrame`s.
4. Downscales each frame: draw to an `OffscreenCanvas(1280, 720)`, create a new `VideoFrame`
   from the canvas, close the original.
5. Pipes downscaled frames through `VideoEncoder` (codec `'avc1.42E01F'`, baseline H.264 720p).
6. Collects encoded chunks via `mp4-muxer`'s `Muxer` (target `'buffer'`) into an MP4.
7. Posts progress messages (`{ type: 'progress', assetId, value }`) every ~10 frames.
8. On finalize, writes the resulting `Uint8Array` to OPFS at `proxies/<assetId>.mp4` and
   posts `{ type: 'done', assetId, proxyPath, durationSec, width, height, fps, thumbnailDataUrl }`.
9. Generates `thumbnailDataUrl` from the first decoded keyframe (256×144 JPEG via
   `OffscreenCanvas.convertToBlob` + `FileReader.readAsDataURL`).

Critical rules:
- Every `VideoFrame.close()` is called in a `try { ... } finally { frame.close(); }` block.
- Backpressure: if `encoder.encodeQueueSize > 8`, await a microtask drain before pushing more.
- On error: post `{ type: 'error', assetId, message }` and clean up the encoder/decoder.

### 9. `src/frontend/apps/video-editor/media/proxy.ts`

Main-thread wrapper:
- `generateProxy(asset: MediaAsset, file: File, onProgress: (v:number)=>void): Promise<ProxyResult>`
- Spawns `new Worker(new URL('../workers/proxy.worker.ts', import.meta.url), { type: 'module' })`
- Resolves on `done`, rejects on `error`.

### 10. `src/frontend/apps/video-editor/state/editorStore.ts`

Zustand store; v1 holds:

```ts
interface EditorState {
  assets: Record<AssetId, MediaAsset>;
  ingestQueue: AssetId[];
  // actions
  ingestFiles(files: File[]): Promise<void>;
  removeAsset(id: AssetId): Promise<void>;
  rehydrateFromOpfs(): Promise<void>;
}
```

Behavior:
- `ingestFiles` creates `MediaAsset` records, adds to queue, runs proxies sequentially
  (max 1 at a time to avoid GPU/CPU saturation), updates progress as it goes.
- `rehydrateFromOpfs` reads `proxies/` from OPFS on app mount and reconstructs
  `MediaAsset` records marked `status: 'missing'` (no `File` available) — user must re-link
  the original to re-enable export-quality work; the proxy alone is enough for preview.
- Persists `assets` metadata (sans `File`) to OPFS at `project/assets.json` after every
  successful ingest and on `removeAsset`.

### 11. `src/frontend/apps/video-editor/ui/Dropzone.tsx`

Big dashed-border drop target. Centered prompt: "Drop videos or photos here, or click to
pick." Hidden `<input type="file" multiple accept="video/*,image/*">`. Drag-over highlight.

### 12. `src/frontend/apps/video-editor/ui/MediaBin.tsx`

Grid of asset cards:
- Thumbnail (or gradient placeholder while ingesting)
- Filename (truncate with title attribute)
- Duration MM:SS + resolution (e.g. `00:34 · 1920×1080`)
- Progress bar overlay while `status === 'ingesting'`
- Error state with retry
- "missing — re-link" state with file-picker action

### 13. `src/frontend/apps/video-editor/index.tsx`

Top-level layout:

- Header: title "Video Editor", subtitle "Strictly client-side · WebCodecs", Reset button
  (matches other Snappet apps; Reset = "Remove all assets and clear OPFS", with confirm).
- If unsupported: render `<UnsupportedBrowser caps={...} />` and stop.
- Else: render `<Dropzone />` + `<MediaBin />` + a hint banner "M2 (timeline + preview) ships next."

Use the `useEditorStore()` Zustand hook; trigger `rehydrateFromOpfs()` once on mount.

## Acceptance criteria

- [ ] `/video-editor` route loads and registers in the hub
- [ ] Unsupported browsers see a friendly screen, not a crash
- [ ] Dropping a 1080p MP4 generates a 720p H.264 proxy in OPFS at `proxies/<assetId>.mp4`
- [ ] Progress bar reflects real ingest progress (not fake)
- [ ] Media bin shows thumbnail + filename + duration + resolution
- [ ] Page reload re-lists assets from OPFS as `missing`; re-pick the original file rehydrates them
- [ ] `tsc --noEmit` clean (no `any`)
- [ ] `npm run build` succeeds; PWA precache list still builds
- [ ] Dark mode supported across all new UI
- [ ] Worker file is `{ type: 'module' }` (so dynamic imports work)
- [ ] Every `VideoFrame.close()` paired with its decode/draw in `try/finally`

## Constraints

- TS strict; no `any` (use `unknown` and narrow, or proper types)
- Tailwind only — no inline styles
- No new heavy deps beyond `zustand` + `mp4box` + `mp4-muxer`
- Worker code must be `{ type: 'module' }` per Vite worker conventions
- All filesystem paths are POSIX with no leading slash
- `useLocalStorage` is NOT used here — editor state lives in Zustand + OPFS (project file
  is too big for localStorage)
- Do not import anything from M2/M3 yet (those modules don't exist; M1 must stand alone)
- Match Snappet header / Reset button style from Tally Counter / Password Generator
