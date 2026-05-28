import type { AssetId, Project } from '../types/timeline'
import type { MediaAsset } from '../types/timeline'

// Mix all audio-bearing clips into a single AudioBuffer using OfflineAudioContext.
// Returns null if the project has no audio sources.
export async function mixProjectAudio(
  project: Project,
  assets: Record<AssetId, MediaAsset>,
  getFile: (assetId: AssetId) => File | undefined,
  durationSec: number,
  sampleRate: number,
): Promise<AudioBuffer | null> {
  if (durationSec <= 0) return null

  // Identify clips on tracks that should contribute audio.
  // M3: video-track clips can carry audio (most users add a single video clip per slot).
  // Skip clips whose asset has no audio.
  const contributors = Object.values(project.clips).filter((c) => {
    const a = assets[c.assetId]
    return a?.hasAudio && getFile(c.assetId) !== undefined
  })
  if (contributors.length === 0) return null

  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(durationSec * sampleRate),
    sampleRate,
  )

  // Decode each unique source file once.
  const decodedCache = new Map<AssetId, AudioBuffer>()
  for (const c of contributors) {
    if (decodedCache.has(c.assetId)) continue
    const file = getFile(c.assetId)
    if (!file) continue
    try {
      const buf = await file.arrayBuffer()
      const audio = await ctx.decodeAudioData(buf.slice(0))
      decodedCache.set(c.assetId, audio)
    } catch {
      // Decode failed; skip silently — the clip contributes silence.
    }
  }

  for (const c of contributors) {
    const audio = decodedCache.get(c.assetId)
    if (!audio) continue
    const src = ctx.createBufferSource()
    src.buffer = audio
    const gain = ctx.createGain()
    gain.gain.value = c.volume ?? 1
    src.connect(gain).connect(ctx.destination)
    const offsetInAsset = Math.max(0, c.inSec)
    const playDur = Math.max(0, c.outSec - c.inSec)
    src.start(c.startSec, offsetInAsset, playDur)
  }

  return await ctx.startRendering()
}

// Slice an AudioBuffer into AudioData chunks (1024 frames each) for the AudioEncoder.
// Caller is responsible for closing each AudioData after encode.
export function audioBufferToChunks(
  buffer: AudioBuffer,
  framesPerChunk = 1024,
): AudioData[] {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const sampleRate = buffer.sampleRate
  const chunks: AudioData[] = []

  // Pre-flatten into a single planar Float32Array per chunk.
  for (let start = 0; start < frames; start += framesPerChunk) {
    const count = Math.min(framesPerChunk, frames - start)
    const data = new Float32Array(channels * count)
    for (let ch = 0; ch < channels; ch++) {
      const src = buffer.getChannelData(ch)
      data.set(src.subarray(start, start + count), ch * count)
    }
    const timestampUs = Math.round((start / sampleRate) * 1_000_000)
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfChannels: channels,
      numberOfFrames: count,
      timestamp: timestampUs,
      data,
    })
    chunks.push(audioData)
  }
  return chunks
}
