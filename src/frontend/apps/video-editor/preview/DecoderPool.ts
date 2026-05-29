import { createFile, DataStream } from 'mp4box'
import type {
  MP4ArrayBuffer,
  MP4File,
  MP4Info,
  MP4Sample,
} from 'mp4box'
import type { AssetId } from '../types/timeline'

interface DecoderEntry {
  decoder: VideoDecoder
  samples: MP4Sample[]
  keyframeIndices: number[]
  description?: Uint8Array
  codec: string
  fps: number
  width: number
  height: number
  timescale: number
  // Decoded frames buffered by timestamp microseconds.
  ringBuffer: VideoFrame[]
  lastUsed: number
  // Index of the next sample to feed the decoder; -1 means the decoder needs
  // a (re)configure + keyframe before it can decode again.
  nextSampleIdx: number
  // Presentation timestamp (µs) of the most recently fed sample, used to decide
  // whether a request can be served by decoding forward or needs a backward seek.
  lastDecodedUs: number
  // True after a flush()/initial configure: the decoder now REQUIRES the next
  // decoded chunk to be a keyframe, so we must reset+start from a keyframe.
  needsKeyframe: boolean
}

const RING_CAPACITY = 24
const MAX_DECODERS = 3

type SourceLoader = (assetId: AssetId) => Promise<Blob | undefined>

export class DecoderPool {
  private entries = new Map<AssetId, DecoderEntry>()
  private loading = new Map<AssetId, Promise<DecoderEntry | null>>()

  constructor(private loadSource: SourceLoader) {}

  async getFrame(assetId: AssetId, sourceTimeSec: number): Promise<VideoFrame | null> {
    const entry = await this.ensureEntry(assetId)
    if (!entry) return null
    entry.lastUsed = performance.now()

    const targetUs = Math.max(0, Math.round(sourceTimeSec * 1_000_000))

    // 1. Check ring buffer for the closest frame at or after target.
    const hit = this.findInRing(entry, targetUs)
    if (hit) {
      return hit.clone()
    }

    // 2. Seek: find the keyframe ≤ target. Reset decoder, decode forward.
    await this.seekAndDecodeTo(entry, targetUs)
    const after = this.findInRing(entry, targetUs)
    if (after) return after.clone()

    // 3. If we couldn't reach target (out of bounds), return last frame.
    const last = entry.ringBuffer[entry.ringBuffer.length - 1]
    return last ? last.clone() : null
  }

  releaseAsset(assetId: AssetId): void {
    const e = this.entries.get(assetId)
    if (!e) return
    for (const f of e.ringBuffer) f.close()
    e.ringBuffer = []
    try {
      e.decoder.close()
    } catch {
      /* ignore */
    }
    this.entries.delete(assetId)
  }

  disposeAll(): void {
    for (const id of Array.from(this.entries.keys())) {
      this.releaseAsset(id)
    }
  }

  private async ensureEntry(assetId: AssetId): Promise<DecoderEntry | null> {
    const existing = this.entries.get(assetId)
    if (existing) return existing
    const pending = this.loading.get(assetId)
    if (pending) return await pending

    const p = this.loadEntry(assetId)
    this.loading.set(assetId, p)
    try {
      const e = await p
      if (e) {
        this.entries.set(assetId, e)
        this.evictIfNeeded()
      }
      return e
    } finally {
      this.loading.delete(assetId)
    }
  }

  private evictIfNeeded(): void {
    while (this.entries.size > MAX_DECODERS) {
      let oldestId: AssetId | null = null
      let oldestTime = Infinity
      for (const [id, e] of this.entries) {
        if (e.lastUsed < oldestTime) {
          oldestTime = e.lastUsed
          oldestId = id
        }
      }
      if (oldestId) this.releaseAsset(oldestId)
      else break
    }
  }

  private async loadEntry(assetId: AssetId): Promise<DecoderEntry | null> {
    const blob = await this.loadSource(assetId)
    if (!blob) return null
    const buf = await blob.arrayBuffer()
    const demuxed = await demuxAll(buf)
    if (!demuxed) return null

    const decoder = new VideoDecoder({
      output: (frame) => {
        // Defer the buffer push until the caller via the closure below.
        currentEntryRing?.push(frame)
        // Trim to capacity.
        if (currentEntryRing && currentEntryRing.length > RING_CAPACITY) {
          currentEntryRing.shift()?.close()
        }
      },
      error: (e) => {
        console.warn('VideoDecoder error:', e)
      },
    })

    // We need `output` to push into the ring buffer for the current entry — but the
    // entry exists in scope; assign a reference and update later.
    let currentEntryRing: VideoFrame[] | null = null

    const entry: DecoderEntry = {
      decoder,
      samples: demuxed.samples,
      keyframeIndices: demuxed.samples
        .map((s, i) => (s.is_sync ? i : -1))
        .filter((i) => i >= 0),
      description: demuxed.description,
      codec: demuxed.codec,
      fps: demuxed.fps,
      width: demuxed.width,
      height: demuxed.height,
      timescale: demuxed.timescale,
      ringBuffer: [],
      lastUsed: performance.now(),
      nextSampleIdx: 0,
      lastDecodedUs: -1,
      // Fresh configure() → the first decoded chunk must be a keyframe.
      needsKeyframe: true,
    }
    currentEntryRing = entry.ringBuffer

    try {
      decoder.configure({
        codec: demuxed.codec,
        codedWidth: demuxed.width,
        codedHeight: demuxed.height,
        optimizeForLatency: true,
        ...(demuxed.description ? { description: demuxed.description } : {}),
      })
    } catch (e) {
      console.warn('VideoDecoder.configure failed:', e)
      return null
    }

    return entry
  }

  private findInRing(entry: DecoderEntry, targetUs: number): VideoFrame | null {
    // Return the frame whose timestamp is the largest value ≤ target.
    let best: VideoFrame | null = null
    let bestTs = -1
    for (const f of entry.ringBuffer) {
      if (f.timestamp <= targetUs && f.timestamp > bestTs) {
        bestTs = f.timestamp
        best = f
      }
    }
    // Tolerance: within ½ frame, accept.
    if (best && targetUs - bestTs <= (1_000_000 / entry.fps) * 0.6) {
      return best
    }
    return null
  }

  private async seekAndDecodeTo(
    entry: DecoderEntry,
    targetUs: number,
  ): Promise<void> {
    // Keyframe index ≤ target (random-access point we'd have to start from).
    let keyIdx = 0
    for (let i = entry.keyframeIndices.length - 1; i >= 0; i--) {
      const idx = entry.keyframeIndices[i]
      const sample = entry.samples[idx]
      const ts = (sample.cts * 1_000_000) / sample.timescale
      if (ts <= targetUs) {
        keyIdx = idx
        break
      }
    }

    const tick = (): Promise<void> =>
      new Promise((r) => setTimeout(r, 0))

    // Forward-continue is only valid if the decoder is mid-stream AND doesn't owe a
    // keyframe (a prior flush()/configure() requires the next chunk to be a keyframe).
    const canDecodeForward =
      entry.nextSampleIdx >= 0 &&
      targetUs >= entry.lastDecodedUs &&
      !entry.needsKeyframe

    let startIdx: number
    if (canDecodeForward) {
      // Skip ahead to a nearer keyframe if one sits between us and the target.
      startIdx = Math.max(entry.nextSampleIdx, keyIdx)
    } else {
      // Backward / first / post-flush seek: reset, reconfigure with the REAL codec
      // (avc/hevc/vp9/av1 — never assume H.264), and start from a keyframe.
      try {
        entry.decoder.reset()
        entry.decoder.configure({
          codec: entry.codec,
          codedWidth: entry.width,
          codedHeight: entry.height,
          optimizeForLatency: true,
          ...(entry.description ? { description: entry.description } : {}),
        })
      } catch {
        entry.nextSampleIdx = -1
        entry.needsKeyframe = true
        return
      }
      for (const f of entry.ringBuffer) f.close()
      entry.ringBuffer.length = 0
      startIdx = keyIdx
      entry.needsKeyframe = true // the next decode (the keyframe at startIdx) clears it
    }

    // Decode from startIdx until the target frame lands in the ring, or up to a few
    // frames past target. We do NOT flush per call — flush() forces a keyframe on the
    // next decode and would break forward continuation. optimizeForLatency lets frames
    // emit as they decode; we just yield to let the output callback run.
    const endTargetUs = targetUs + (1_000_000 / entry.fps) * 8
    for (let i = startIdx; i < entry.samples.length; i++) {
      const s = entry.samples[i]
      const isKey = s.is_sync
      // After a (re)configure, the first chunk MUST be a keyframe; skip until one.
      if (entry.needsKeyframe && !isKey) continue
      const ts = (s.cts * 1_000_000) / s.timescale
      const chunk = new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta',
        timestamp: ts,
        duration: (s.duration * 1_000_000) / s.timescale,
        data: s.data,
      })
      try {
        entry.decoder.decode(chunk)
      } catch {
        entry.nextSampleIdx = -1
        entry.needsKeyframe = true
        return
      }
      entry.needsKeyframe = false
      entry.nextSampleIdx = i + 1
      entry.lastDecodedUs = ts
      if ((i - startIdx) % 6 === 5) {
        await tick()
        if (this.findInRing(entry, targetUs)) return
      }
      if (ts > endTargetUs) break
    }

    // Let in-flight outputs arrive (no flush).
    for (let t = 0; t < 12 && !this.findInRing(entry, targetUs); t++) {
      await tick()
    }
    // Only if we ran out of samples and still don't have the frame do we flush to
    // drain the reorder buffer — then the decoder owes a keyframe next time.
    if (
      entry.nextSampleIdx >= entry.samples.length &&
      !this.findInRing(entry, targetUs)
    ) {
      await entry.decoder.flush().catch(() => undefined)
      entry.needsKeyframe = true
      entry.nextSampleIdx = -1
    }
  }
}

interface DemuxAllResult {
  samples: MP4Sample[]
  codec: string
  width: number
  height: number
  fps: number
  timescale: number
  description?: Uint8Array
}

async function demuxAll(buf: ArrayBuffer): Promise<DemuxAllResult | null> {
  return await new Promise<DemuxAllResult | null>((resolve, reject) => {
    const mp4: MP4File = createFile(true)
    const samples: MP4Sample[] = []
    let resolved = false
    mp4.onError = (err) => reject(new Error(err))
    mp4.onReady = (info: MP4Info) => {
      const v = info.videoTracks[0]
      if (!v) {
        resolve(null)
        resolved = true
        return
      }
      mp4.setExtractionOptions(v.id, null, { nbSamples: 1024 })
      mp4.start()
    }
    mp4.onSamples = (_id, _user, ss) => {
      for (const s of ss) samples.push(s)
    }
    const CHUNK = 1024 * 1024
    let offset = 0
    while (offset < buf.byteLength) {
      const end = Math.min(offset + CHUNK, buf.byteLength)
      const slice = buf.slice(offset, end) as MP4ArrayBuffer
      slice.fileStart = offset
      mp4.appendBuffer(slice)
      offset = end
    }
    mp4.flush()
    if (!resolved) {
      // After flush, mp4box may not call onReady if the file is malformed.
      const info = (mp4 as unknown as { moov?: unknown }).moov
        ? (mp4 as unknown as { getInfo?: () => MP4Info }).getInfo?.()
        : undefined
      if (info) {
        const v = info.videoTracks[0]
        if (v) {
          const description = extractDescription(mp4, v.id)
          const trackDur = v.duration / v.timescale
          const fps = trackDur > 0 ? v.nb_samples / trackDur : 30
          resolve({
            samples,
            codec: v.codec,
            width: v.video.width,
            height: v.video.height,
            fps,
            timescale: v.timescale,
            description,
          })
          return
        }
      }
    }
    // The synchronous onReady will resolve before we get here in well-formed mp4s.
    setTimeout(() => {
      // Last-resort: if samples got collected but resolve not called, attempt finalize.
      if (samples.length > 0) {
        const f = mp4 as unknown as {
          getInfo?: () => MP4Info | undefined
        }
        const info = f.getInfo?.()
        if (info && info.videoTracks[0]) {
          const v = info.videoTracks[0]
          const description = extractDescription(mp4, v.id)
          const trackDur = v.duration / v.timescale
          const fps = trackDur > 0 ? v.nb_samples / trackDur : 30
          resolve({
            samples,
            codec: v.codec,
            width: v.video.width,
            height: v.video.height,
            fps,
            timescale: v.timescale,
            description,
          })
        } else {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    }, 0)
  })
}

function extractDescription(
  mp4: MP4File,
  trackId: number,
): Uint8Array | undefined {
  const file = mp4 as unknown as {
    moov?: {
      traks: Array<{
        tkhd: { track_id: number }
        mdia: {
          minf: { stbl: { stsd: { entries: Array<Record<string, unknown>> } } }
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
  try {
    const ds = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
    descBox.write(ds)
    const u8 = new Uint8Array(ds.buffer)
    return u8.byteLength > 8 ? u8.slice(8) : undefined
  } catch {
    return undefined
  }
}
