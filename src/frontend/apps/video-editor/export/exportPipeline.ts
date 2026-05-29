import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type {
  AssetId,
  MediaAsset,
  Project,
} from '../types/timeline'
import {
  activeTextOverlays,
  clipsAtTime,
  sourceTimeForClip,
  totalDurationSec,
  transitionDim,
} from '../state/selectors'
import { DecoderPool } from '../preview/DecoderPool'
import { audioBufferToChunks, mixProjectAudio } from './audioMixer'
import { toCssFilter } from '../types/filters'
import type { TextOverlay } from '../types/timeline'

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

// Draw active text overlays into the output frame. Coordinates are normalized so
// this matches the DOM preview layer (TextOverlayLayer) 1:1.
function drawTextOverlays(
  ctx: Ctx2D,
  overlays: TextOverlay[],
  W: number,
  H: number,
): void {
  for (const o of overlays) {
    const px = Math.round(o.fontSize * H)
    ctx.font = `${o.bold ? '700' : '400'} ${px}px system-ui, sans-serif`
    ctx.textAlign = o.align
    ctx.textBaseline = 'middle'
    const lines = (o.text || ' ').split('\n')
    const lineH = px * 1.15
    const cx = o.x * W
    const cy = o.y * H
    const top = cy - ((lines.length - 1) * lineH) / 2
    if (o.bg) {
      let maxW = 0
      for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width)
      const padX = px * 0.3
      const padY = px * 0.15
      const boxW = maxW + padX * 2
      const boxH = lines.length * lineH + padY * 2
      const boxX =
        o.align === 'left' ? cx - padX : o.align === 'right' ? cx - boxW + padX : cx - boxW / 2
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(boxX, top - lineH / 2 - padY, boxW, boxH)
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = px * 0.08
      ctx.shadowOffsetY = px * 0.03
    }
    ctx.fillStyle = o.color
    lines.forEach((ln, i) => ctx.fillText(ln, cx, top + i * lineH))
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }
}

export interface ExportOptions {
  width: number
  height: number
  fps: number
  videoBitrate: number
  audioBitrate: number
  filename: string
}

export type ExportPhase =
  | 'preparing'
  | 'encoding-video'
  | 'encoding-audio'
  | 'muxing'
  | 'done'
  | 'error'

export interface ExportProgress {
  phase: ExportPhase
  framesDone?: number
  framesTotal?: number
  bytesWritten?: number
  errorMessage?: string
}

export class ExportError extends Error {}

export async function runExport(
  project: Project,
  assets: Record<AssetId, MediaAsset>,
  getFile: (assetId: AssetId) => File | undefined,
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<Blob> {
  onProgress({ phase: 'preparing' })

  const durationSec = totalDurationSec(project)
  if (durationSec <= 0) throw new ExportError('Nothing to export')

  // Validate all referenced assets have an original file (export needs full quality).
  const missing: string[] = []
  for (const c of Object.values(project.clips)) {
    if (!getFile(c.assetId)) {
      const a = assets[c.assetId]
      missing.push(a?.name ?? c.assetId)
    }
  }
  if (missing.length > 0) {
    throw new ExportError(
      `Re-link the original file(s) before exporting: ${missing.join(', ')}`,
    )
  }

  const sampleRate = 48000
  // Mix audio first (parallel with the video encode loop below).
  const audioPromise = mixProjectAudio(
    project,
    assets,
    getFile,
    durationSec,
    sampleRate,
  )

  // Only mux/encode audio if any clip has it AND this browser exposes AudioEncoder.
  // (A browser can ship VideoEncoder without AudioEncoder; export should still
  // succeed, just video-only, rather than throwing a ReferenceError.)
  const audioEncoderAvailable = typeof AudioEncoder === 'function'
  const hasAudio =
    audioEncoderAvailable &&
    Object.values(project.clips).some((c) => assets[c.assetId]?.hasAudio)

  // WebCodecs reports async failures via the error callback (a separate task);
  // throwing there can't reject runExport. Capture and rethrow at an await point.
  let fatalError: Error | null = null
  const onCodecError = (e: DOMException | Error): void => {
    if (!fatalError) fatalError = e instanceof Error ? e : new Error(String(e))
  }
  const throwIfFatal = (): void => {
    if (fatalError) throw new ExportError(fatalError.message)
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: opts.width,
      height: opts.height,
      frameRate: opts.fps,
    },
    audio: hasAudio
      ? {
          codec: 'aac',
          numberOfChannels: 2,
          sampleRate,
        }
      : undefined,
    fastStart: 'in-memory',
  })

  // Video encoder.
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: onCodecError,
  })
  videoEncoder.configure({
    codec: 'avc1.42E01F',
    width: opts.width,
    height: opts.height,
    bitrate: opts.videoBitrate,
    framerate: opts.fps,
  })

  // Audio encoder (configured only if we have audio).
  let audioEncoder: AudioEncoder | null = null
  if (hasAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: onCodecError,
    })
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels: 2,
      bitrate: opts.audioBitrate,
    })
  }

  // Set up a decoder pool reading from the ORIGINAL files (full quality).
  const pool = new DecoderPool(async (assetId) => {
    const f = getFile(assetId)
    if (!f) return undefined
    return f.slice(0)
  })

  // Off-screen canvas for compositing each frame.
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(opts.width, opts.height)
      : (() => {
          const c = document.createElement('canvas')
          c.width = opts.width
          c.height = opts.height
          return c
        })()
  const ctx = canvas.getContext('2d', { alpha: false }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new ExportError('Could not get 2D context for export')

  const totalFrames = Math.max(1, Math.ceil(durationSec * opts.fps))
  onProgress({
    phase: 'encoding-video',
    framesDone: 0,
    framesTotal: totalFrames,
  })

  try {
    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (signal.aborted) throw new ExportError('Export cancelled')
      throwIfFatal()

      const t = frameIdx / opts.fps
      const active = clipsAtTime(project, t, 'video')

      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, opts.width, opts.height)

      if (active.length > 0) {
        const top = active[active.length - 1]
        const srcTime = sourceTimeForClip(top, t)
        const frame = await pool.getFrame(top.assetId, srcTime)
        if (frame) {
          try {
            const fW = frame.displayWidth
            const fH = frame.displayHeight
            // contain = fit inside (letterbox); cover = fill + crop overflow.
            const s =
              top.fit === 'cover'
                ? Math.max(opts.width / fW, opts.height / fH)
                : Math.min(opts.width / fW, opts.height / fH)
            const dW = Math.round(fW * s)
            const dH = Math.round(fH * s)
            const dx = Math.round((opts.width - dW) / 2)
            const dy = Math.round((opts.height - dH) / 2)
            // Same CSS-filter string as the preview canvas → WYSIWYG color.
            ctx.filter = toCssFilter(top.filters)
            // Leading-edge fade-from-black: lower opacity over the black bg.
            const dim = transitionDim(top, t)
            if (dim > 0) ctx.globalAlpha = 1 - dim
            ctx.drawImage(
              frame as unknown as CanvasImageSource,
              dx,
              dy,
              dW,
              dH,
            )
            ctx.globalAlpha = 1
            ctx.filter = 'none'
          } finally {
            frame.close()
          }
        }
      }

      // Text overlays composite on top of the video, after filters.
      const overlays = activeTextOverlays(project, t)
      if (overlays.length > 0) {
        drawTextOverlays(ctx, overlays, opts.width, opts.height)
      }

      const timestampUs = Math.round((frameIdx * 1_000_000) / opts.fps)
      const durationUsPerFrame = Math.round(1_000_000 / opts.fps)
      const outFrame = new VideoFrame(canvas as unknown as CanvasImageSource, {
        timestamp: timestampUs,
        duration: durationUsPerFrame,
      })
      try {
        // Backpressure: don't outrun the encoder.
        while (videoEncoder.encodeQueueSize > 8) {
          await new Promise((r) => setTimeout(r, 0))
        }
        const isKey = frameIdx % 60 === 0
        videoEncoder.encode(outFrame, { keyFrame: isKey })
      } finally {
        outFrame.close()
      }

      if (frameIdx % 6 === 0 || frameIdx === totalFrames - 1) {
        onProgress({
          phase: 'encoding-video',
          framesDone: frameIdx + 1,
          framesTotal: totalFrames,
        })
      }
    }

    await videoEncoder.flush()
    videoEncoder.close()
    throwIfFatal()

    // Now feed audio.
    const audioBuffer = await audioPromise
    if (audioBuffer && audioEncoder) {
      onProgress({ phase: 'encoding-audio' })
      const chunks = audioBufferToChunks(audioBuffer, 1024)
      for (const ad of chunks) {
        try {
          while (audioEncoder.encodeQueueSize > 8) {
            await new Promise((r) => setTimeout(r, 0))
          }
          audioEncoder.encode(ad)
        } finally {
          ad.close()
        }
      }
      await audioEncoder.flush()
      audioEncoder.close()
      throwIfFatal()
    } else if (audioEncoder) {
      // We declared audio in the muxer but mixing produced nothing — close cleanly.
      audioEncoder.close()
    }

    onProgress({ phase: 'muxing' })
    muxer.finalize()
    const buf = (muxer.target as ArrayBufferTarget).buffer
    const blob = new Blob([buf], { type: 'video/mp4' })
    onProgress({ phase: 'done', bytesWritten: blob.size })
    return blob
  } finally {
    pool.disposeAll()
  }
}

export const EXPORT_PRESETS: Array<{
  label: string
  width: number
  height: number
  fps: number
  videoBitrate: number
  audioBitrate: number
}> = [
  {
    label: '720p · 30fps · 5 Mbps',
    width: 1280,
    height: 720,
    fps: 30,
    videoBitrate: 5_000_000,
    audioBitrate: 128_000,
  },
  {
    label: '1080p · 30fps · 8 Mbps (default)',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 8_000_000,
    audioBitrate: 192_000,
  },
  {
    label: '1080p · 60fps · 12 Mbps',
    width: 1920,
    height: 1080,
    fps: 60,
    videoBitrate: 12_000_000,
    audioBitrate: 192_000,
  },
]
