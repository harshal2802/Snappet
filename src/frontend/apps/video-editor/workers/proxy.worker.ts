/// <reference lib="webworker" />
import { createFile } from 'mp4box'
import type {
  MP4ArrayBuffer,
  MP4File,
  MP4Info,
  MP4Sample,
  MP4VideoTrackInfo,
} from 'mp4box'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { ProxyWorkerInit, ProxyWorkerMessage } from '../types/codec'
import { writeFile } from '../media/opfs'

// Worker entry point.
self.onmessage = (ev: MessageEvent<ProxyWorkerInit>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    void runProxy(msg).catch((err: Error) => {
      post({ type: 'error', assetId: msg.assetId, message: err.message })
    })
  }
}

function post(msg: ProxyWorkerMessage): void {
  ;(self as unknown as Worker).postMessage(msg)
}

// Extract the avcC/hvcC/vpcC/av1C description bytes for VideoDecoder.configure.
// mp4box exposes the parsed boxes on the internal `moov.traks` tree.
function extractDescription(
  mp4: MP4File,
  trackId: number,
): Uint8Array | undefined {
  // Reach into mp4box internals; not in our type shim.
  const file = mp4 as unknown as {
    moov?: {
      traks: Array<{
        tkhd: { track_id: number }
        mdia: {
          minf: {
            stbl: {
              stsd: {
                entries: Array<Record<string, unknown>>
              }
            }
          }
        }
      }>
    }
  }
  const trak = file.moov?.traks.find((t) => t.tkhd.track_id === trackId)
  if (!trak) return undefined
  const entry = trak.mdia.minf.stbl.stsd.entries[0] as Record<string, unknown>
  const descBox =
    (entry.avcC as { write: (s: unknown) => void } | undefined) ??
    (entry.hvcC as { write: (s: unknown) => void } | undefined) ??
    (entry.vpcC as { write: (s: unknown) => void } | undefined) ??
    (entry.av1C as { write: (s: unknown) => void } | undefined)
  if (!descBox) return undefined
  // Build a temporary DataStream-like writer to capture the box bytes.
  // mp4box exposes DataStream globally inside the bundle; recreate the
  // minimal subset we need by collecting bytes through write methods.
  // Simpler: ask mp4box for the file's DataStream via dynamic import.
  // Fall back: many real-world clips have avcC.SPS/.PPS arrays — pack manually.
  try {
    // Try mp4box's bundled DataStream (it's attached to globalThis via module side effects).
    const g = globalThis as unknown as {
      DataStream?: new (
        buf?: ArrayBuffer,
        offset?: number,
        endianness?: number,
      ) => {
        buffer: ArrayBuffer
        endianness: number
      }
    }
    if (g.DataStream) {
      const ds = new g.DataStream(undefined, 0, 0 /* BIG_ENDIAN */)
      descBox.write(ds)
      // Skip the 8-byte box header (size + type) for VideoDecoder.
      const u8 = new Uint8Array(ds.buffer)
      return u8.subarray(8)
    }
  } catch {
    /* fall through */
  }
  return undefined
}

async function runProxy(init: ProxyWorkerInit): Promise<void> {
  const { assetId, file, targetWidth, targetHeight, targetBitrate } = init

  const probe = await demux(file)
  if (!probe.videoTrack) {
    throw new Error('No video track found in file')
  }

  const srcWidth = probe.videoTrack.video.width
  const srcHeight = probe.videoTrack.video.height
  // Scale to fit within target while preserving aspect, snapping to even pixels.
  const aspect = srcWidth / srcHeight
  let outW = targetWidth
  let outH = Math.round(targetWidth / aspect)
  if (outH > targetHeight) {
    outH = targetHeight
    outW = Math.round(targetHeight * aspect)
  }
  outW = outW - (outW % 2)
  outH = outH - (outH % 2)

  const fps = probe.fps || 30
  const durationSec = probe.durationSec
  const totalFrames = Math.max(1, Math.round(durationSec * fps))

  // Set up the encoder + muxer first so we can route decoded frames straight through.
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: outW,
      height: outH,
      frameRate: fps,
    },
    fastStart: 'in-memory',
  })

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta)
    },
    error: (e) => {
      throw e
    },
  })
  encoder.configure({
    codec: 'avc1.42E01F', // H.264 baseline 3.1
    width: outW,
    height: outH,
    bitrate: targetBitrate,
    framerate: fps,
  })

  // Compose downsizing on an OffscreenCanvas; convert canvas -> VideoFrame.
  const canvas = new OffscreenCanvas(outW, outH)
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable')

  let thumbnailDataUrl: string | undefined
  let framesEncoded = 0
  let lastReportedProgress = 0

  const decoder = new VideoDecoder({
    output: async (frame) => {
      try {
        // Draw scaled into target canvas; preserve aspect with letterboxing.
        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, outW, outH)
        const fW = frame.displayWidth
        const fH = frame.displayHeight
        const s = Math.min(outW / fW, outH / fH)
        const dW = Math.round(fW * s)
        const dH = Math.round(fH * s)
        const dx = Math.round((outW - dW) / 2)
        const dy = Math.round((outH - dH) / 2)
        ctx.drawImage(frame, dx, dy, dW, dH)

        // Capture thumbnail from the first frame.
        if (!thumbnailDataUrl) {
          const thumbCanvas = new OffscreenCanvas(256, 144)
          const thumbCtx = thumbCanvas.getContext('2d')
          if (thumbCtx) {
            thumbCtx.fillStyle = 'black'
            thumbCtx.fillRect(0, 0, 256, 144)
            const ts = Math.min(256 / fW, 144 / fH)
            const tw = Math.round(fW * ts)
            const th = Math.round(fH * ts)
            thumbCtx.drawImage(
              frame,
              Math.round((256 - tw) / 2),
              Math.round((144 - th) / 2),
              tw,
              th,
            )
            const blob = await thumbCanvas.convertToBlob({
              type: 'image/jpeg',
              quality: 0.7,
            })
            thumbnailDataUrl = await blobToDataUrl(blob)
          }
        }

        const newFrame = new VideoFrame(canvas, {
          timestamp: frame.timestamp,
          duration: Math.round(1_000_000 / fps),
        })
        try {
          // Backpressure: don't let the encoder queue blow up.
          while (encoder.encodeQueueSize > 8) {
            await new Promise((r) => setTimeout(r, 0))
          }
          const isKey = framesEncoded % 60 === 0
          encoder.encode(newFrame, { keyFrame: isKey })
        } finally {
          newFrame.close()
        }

        framesEncoded++
        const pct = Math.min(1, framesEncoded / totalFrames)
        if (pct - lastReportedProgress > 0.02) {
          lastReportedProgress = pct
          post({ type: 'progress', assetId, value: pct })
        }
      } finally {
        frame.close()
      }
    },
    error: (e) => {
      throw e
    },
  })

  const description = extractDescription(probe.mp4, probe.videoTrack.id)
  decoder.configure({
    codec: probe.videoTrack.codec,
    codedWidth: srcWidth,
    codedHeight: srcHeight,
    ...(description ? { description } : {}),
  })

  // Stream samples to the decoder.
  for (const sample of probe.samples) {
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    })
    decoder.decode(chunk)
    // Drain the decoder queue every so often.
    while (decoder.decodeQueueSize > 16) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  await decoder.flush()
  decoder.close()
  await encoder.flush()
  encoder.close()
  muxer.finalize()

  const buf = (muxer.target as ArrayBufferTarget).buffer
  const proxyPath = `proxies/${assetId}.mp4`
  await writeFile(proxyPath, new Uint8Array(buf))

  post({ type: 'progress', assetId, value: 1 })
  post({
    type: 'done',
    assetId,
    proxyPath,
    durationSec,
    width: outW,
    height: outH,
    fps,
    hasAudio: probe.hasAudio,
    thumbnailDataUrl,
  })
}

interface DemuxResult {
  mp4: MP4File
  videoTrack: MP4VideoTrackInfo
  samples: MP4Sample[]
  fps: number
  durationSec: number
  hasAudio: boolean
}

async function demux(file: File): Promise<DemuxResult> {
  return await new Promise<DemuxResult>((resolve, reject) => {
    const mp4 = createFile(true)
    let info: MP4Info | null = null
    const samples: MP4Sample[] = []
    let done = false

    mp4.onError = (err) => reject(new Error(err))
    mp4.onReady = (i) => {
      info = i
      const v = i.videoTracks[0]
      if (!v) {
        reject(new Error('No video track'))
        return
      }
      mp4.setExtractionOptions(v.id, null, { nbSamples: 1024 })
      mp4.start()
    }
    mp4.onSamples = (_trackId, _user, ss) => {
      for (const s of ss) samples.push(s)
    }

    const CHUNK = 1024 * 1024
    let offset = 0
    const reader = new FileReader()
    const pump = (): void => {
      if (done) return
      if (offset >= file.size) {
        mp4.flush()
        done = true
        if (!info) {
          reject(new Error('mp4box: never became ready'))
          return
        }
        const v = info.videoTracks[0]
        const trackDurSec = v.duration / v.timescale
        const fps =
          trackDurSec > 0 && v.nb_samples > 0
            ? v.nb_samples / trackDurSec
            : 30
        resolve({
          mp4,
          videoTrack: v,
          samples,
          fps,
          durationSec: info.duration / info.timescale,
          hasAudio: info.audioTracks.length > 0,
        })
        return
      }
      const slice = file.slice(offset, offset + CHUNK)
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer
        const tagged = buf as MP4ArrayBuffer
        tagged.fileStart = offset
        mp4.appendBuffer(tagged)
        offset += buf.byteLength
        queueMicrotask(pump)
      }
      reader.onerror = () => reject(new Error('Failed to read file slice'))
      reader.readAsArrayBuffer(slice)
    }
    pump()
  })
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Failed to read blob'))
    r.readAsDataURL(blob)
  })
}
