# Prompt: Video Editor — M3 Export

**File**: pdd/prompts/features/video-editor/37-video-editor-03-export.md
**Created**: 2026-05-28
**Project type**: Frontend / Web app
**Source**: GitHub issue #48 + PLAN-video-editor.md (Phase M3)
**Depends on**: M1, M2

## Context

The Media Bin + Timeline + Preview from M1+M2 give a complete editing experience but no
way out. This phase ships **export**: composite the timeline frame-by-frame against the
**original** source media (not the proxy), encode to H.264, mix audio, mux to MP4, and
hand the result to the user via the best available channel (Web Share → Save Picker →
anchor download).

Export runs **off the main thread** (worker) so the UI stays responsive and the user can
cancel.

## Task

Add a full export pipeline reachable from the toolbar's **Export** button. The user picks
a preset (720p / 1080p), watches a real progress bar, and gets the result through their
platform's natural "save" path.

## Output format

### 1. `src/frontend/apps/video-editor/export/exportPipeline.ts`

Public API:

```ts
export interface ExportOptions {
  width: number;          // 1280 or 1920
  height: number;         // 720 or 1080
  fps: number;            // 30 or 60
  videoBitrate: number;   // bits/sec
  audioBitrate: number;   // bits/sec
  filename: string;
}

export interface ExportProgress {
  phase: 'preparing' | 'encoding-video' | 'encoding-audio' | 'muxing' | 'done' | 'error';
  framesDone?: number;
  framesTotal?: number;
  bytesWritten?: number;
  errorMessage?: string;
}

export function runExport(
  project: Project,
  assets: Record<AssetId, MediaAsset>,
  getFile: (assetId: AssetId) => File | undefined,
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal
): Promise<Blob>;
```

Orchestrator:
1. Resolve the timeline duration; compute `totalFrames = ceil(duration * fps)`.
2. Build a sorted timeline of `{startFrame, endFrame, clip, sourceFps}` entries per track
   (one video track only in M2/M3).
3. Spawn the `encoder.worker.ts` and post `init`. Worker creates `VideoEncoder` + `Muxer`.
4. Spin up a `DecoderPool` (same class as preview) **but against original Files**
   (export quality) — main-thread for now; the heavy WebGL/composite happens on an
   `OffscreenCanvas` shared with the worker via transfer.
5. For each `frameIdx` 0..totalFrames-1:
   - Find the active clip at `t = frameIdx / opts.fps`.
   - Get the decoded `VideoFrame` from the pool.
   - Composite onto an `OffscreenCanvas(opts.width, opts.height)` (contain, black bars).
   - Create a `VideoFrame` from the canvas with `timestamp = frameIdx * 1e6 / opts.fps` us.
   - Post the frame (transfer) to the worker; worker encodes; close the frame after transfer.
   - Every 6 frames, report progress.
   - Check `signal.aborted` between frames; if aborted, send `abort` to worker and reject.
6. After the last frame, run the audio path in parallel (see audioMixer below).
7. Worker finalizes muxer; returns the `Uint8Array`; main wraps in `Blob({type:'video/mp4'})`.

### 2. `src/frontend/apps/video-editor/workers/encoder.worker.ts`

Owns `VideoEncoder` + `AudioEncoder` + `mp4-muxer` `Muxer({ target: new ArrayBufferTarget() })`.

Message types:
- `{type:'init', opts, hasAudio}` → set up encoders + muxer
- `{type:'video-frame', frame: VideoFrame, keyFrame: boolean}` → encoder.encode(frame, {keyFrame})
- `{type:'audio-data', data: AudioData}` → audioEncoder.encode(data)
- `{type:'finalize'}` → flush both encoders; muxer.finalize(); return buffer
- `{type:'abort'}` → close encoders, reject any pending finalize

Backpressure: after each `encode`, if `encoder.encodeQueueSize > 8`, await microtask drain.

Video codec: `'avc1.42E01F'` (H.264 baseline) for max compatibility; keyframe every 60 frames.
Audio codec: `'mp4a.40.2'` (AAC-LC) 48 kHz stereo.

### 3. `src/frontend/apps/video-editor/export/audioMixer.ts`

```ts
export async function mixProjectAudio(
  project: Project,
  assets: Record<AssetId, MediaAsset>,
  getFile: (assetId: AssetId) => File | undefined,
  durationSec: number,
  sampleRate: number,
  onProgress?: (v: number) => void
): Promise<AudioBuffer>;
```

Implementation: use `OfflineAudioContext(2, durationSec * sampleRate, sampleRate)`. For each
clip on an audio-bearing track:
- Read the original file as `ArrayBuffer`.
- `ctx.decodeAudioData(buf)` → AudioBuffer.
- Create a `BufferSource`, set `buffer`, set `start(clip.startSec, clip.inSec, clip.outSec - clip.inSec)`.
- Apply a `GainNode` if `clip.volume != null`.
- Connect to `ctx.destination`.

After `ctx.startRendering()`, slice the resulting AudioBuffer into 1024-sample
`AudioData` chunks and stream them to the worker via the pipeline message channel.

If `project` has no audio-bearing clips, skip this path entirely (and `init` the worker
without an audio encoder).

### 4. `src/frontend/apps/video-editor/export/videoMuxer.ts`

Thin wrapper around `mp4-muxer`'s `Muxer` used by the worker:

```ts
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export function createMuxer(opts: ExportOptions, hasAudio: boolean) {
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: opts.width, height: opts.height, frameRate: opts.fps },
    audio: hasAudio
      ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 }
      : undefined,
    fastStart: 'in-memory',
  });
  return muxer;
}
```

### 5. `src/frontend/apps/video-editor/media/share.ts`

```ts
export type DeliveryResult =
  | { kind: 'shared' }
  | { kind: 'saved'; path?: string }
  | { kind: 'downloaded'; filename: string };

export async function deliverFile(blob: Blob, filename: string): Promise<DeliveryResult>;
```

Decision tree:
1. If `navigator.canShare?.({ files: [<file>] }) === true` → `navigator.share({ files, title })`.
   On user cancel → fall through to next.
2. Else if `'showSaveFilePicker' in window` → open picker with `types: [{description:'MP4', accept: {'video/mp4': ['.mp4']}}]`, write the blob.
3. Else → create an `<a>` with `download={filename}` and `href={URL.createObjectURL(blob)}`, click it, revoke URL after 60s.

### 6. `src/frontend/apps/video-editor/ui/ExportDialog.tsx`

Modal:
- **Preset** radio group: "720p 30fps (smaller, faster)" / "1080p 30fps (default)" /
  "1080p 60fps (smooth, larger)"
- **Filename** input (prefilled `snappet-<timestamp>.mp4`)
- Estimated bitrate display
- **Export** button → disables, shows real progress bar (uses `runExport` progress callback)
- **Cancel** button → aborts via `AbortController`
- On done: success state with "Share again / Download again" + "Close"

Layout fits both desktop and mobile (full-screen on mobile).

### 7. `src/frontend/apps/video-editor/ui/Toolbar.tsx` (extend M2)

Replace the M2 "Export coming in M3" hint with a real **Export** button (right side,
primary color). Opens `<ExportDialog />`. Disabled if `totalDurationSec(project) === 0`.

### 8. `src/frontend/apps/video-editor/index.tsx` (extend M2)

Mount `<ExportDialog />` conditionally via a Zustand `exportDialogOpen` flag.

## Acceptance criteria

- [ ] **Export** button in Toolbar opens the dialog
- [ ] Choosing a preset and clicking Export shows real progress that increments steadily
- [ ] On mobile, the result opens the system share sheet (Save to Photos available)
- [ ] On desktop Chrome/Edge, the Save Picker opens with the suggested filename
- [ ] On Firefox/Safari desktop, the file downloads to Downloads
- [ ] Cancel mid-export terminates the worker and frees frames
- [ ] Exported MP4 plays correctly in QuickTime, VLC, and Chrome `<video>`
- [ ] Audio is present and in sync if the source had audio
- [ ] Output dimensions match the chosen preset; black bars added for aspect mismatch
- [ ] No `VideoFrame` leaks after a full export run (monitor `performance.memory` in DevTools)
- [ ] `tsc --noEmit` clean
- [ ] `npm run build` succeeds; worker bundles correctly

## Constraints

- TS strict; no `any`
- All timestamps in **microseconds** at API boundaries (matches WebCodecs convention)
- `mp4-muxer` requires `ArrayBufferTarget` for in-memory output
- Worker MUST be `{ type: 'module' }`
- Audio path is independent from video — encode them in parallel; mux them at the end
- Do not use `MediaRecorder` as a fallback — produces WebM with poor quality control
- Cancel must propagate within ≤1 second
- The export must run against the **original** source files, not the OPFS proxies
  (proxies are 720p — using them for a 1080p export would visibly degrade quality).
  If the original `File` is unavailable (`status: 'missing'`), the dialog must show an
  inline "re-link missing media" prompt rather than letting the user export a corrupted MP4.
