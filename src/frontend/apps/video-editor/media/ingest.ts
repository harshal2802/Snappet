import { createFile } from 'mp4box'
import type { MP4ArrayBuffer, MP4Info } from 'mp4box'
import type { MediaAsset, AssetId } from '../types/timeline'

export function newAssetId(): AssetId {
  // Crypto-random short id for an asset's lifetime.
  const a = new Uint8Array(8)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

interface ProbeResult {
  durationSec: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
}

// Probe via mp4box for MP4/MOV. For other containers (webm, etc.) fall back to
// a <video> element which is universally supported for metadata.
export async function probeFile(file: File): Promise<ProbeResult> {
  const isMp4Like =
    file.type === 'video/mp4' ||
    file.type === 'video/quicktime' ||
    /\.(mp4|mov|m4v)$/i.test(file.name)

  if (isMp4Like) {
    try {
      return await probeMp4(file)
    } catch {
      // Fall through to the generic probe.
    }
  }
  return await probeViaVideoElement(file)
}

async function probeMp4(file: File): Promise<ProbeResult> {
  return await new Promise<ProbeResult>((resolve, reject) => {
    const mp4 = createFile(false)
    mp4.onError = (err) => reject(new Error(err))
    mp4.onReady = (info: MP4Info) => {
      const v = info.videoTracks[0]
      const durationSec = info.duration / info.timescale
      if (!v) {
        resolve({
          durationSec,
          width: 0,
          height: 0,
          fps: 0,
          hasAudio: info.audioTracks.length > 0,
        })
        return
      }
      // nb_samples / duration_in_secs = fps
      const trackDurSec = v.duration / v.timescale
      const fps =
        trackDurSec > 0 && v.nb_samples > 0 ? v.nb_samples / trackDurSec : 30
      resolve({
        durationSec,
        width: v.video.width,
        height: v.video.height,
        fps: Math.round(fps * 1000) / 1000,
        hasAudio: info.audioTracks.length > 0,
      })
    }

    // Stream the file into mp4box in 1MB chunks until onReady fires.
    const CHUNK = 1024 * 1024
    let offset = 0
    let ready = false
    const origOnReady = mp4.onReady
    mp4.onReady = (info) => {
      ready = true
      origOnReady?.(info)
    }

    const reader = new FileReader()
    const pump = (): void => {
      if (ready) return
      if (offset >= file.size) {
        mp4.flush()
        if (!ready) reject(new Error('mp4box: never became ready'))
        return
      }
      const slice = file.slice(offset, offset + CHUNK)
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer
        const tagged = buf as MP4ArrayBuffer
        tagged.fileStart = offset
        mp4.appendBuffer(tagged)
        offset += buf.byteLength
        // Continue async; if onReady already fired, stop.
        queueMicrotask(pump)
      }
      reader.onerror = () => reject(new Error('Failed to read file slice'))
      reader.readAsArrayBuffer(slice)
    }
    pump()
  })
}

async function probeViaVideoElement(file: File): Promise<ProbeResult> {
  return await new Promise<ProbeResult>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false
    const cleanup = (): void => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
    }
    // Some files never fire loadedmetadata or error (unsupported container);
    // don't let ingest hang on them.
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Timed out reading video metadata'))
    }, 15_000)

    video.preload = 'metadata'
    video.muted = true
    video.src = url
    video.onloadedmetadata = () => {
      if (settled) return
      settled = true
      const out: ProbeResult = {
        durationSec: isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30,
        hasAudio: true, // We can't reliably detect this; assume yes and let export handle silence.
      }
      cleanup()
      resolve(out)
    }
    video.onerror = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Failed to read video metadata'))
    }
  })
}

export function makeAssetFromFile(file: File, probe: ProbeResult): MediaAsset {
  return {
    id: newAssetId(),
    name: file.name,
    kind: 'video',
    mimeType: file.type || 'video/mp4',
    sourceBytes: file.size,
    durationSec: probe.durationSec,
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
    hasAudio: probe.hasAudio,
    status: 'ingesting',
    ingestProgress: 0,
  }
}
