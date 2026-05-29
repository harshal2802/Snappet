import type { Project } from '../types/timeline'
import { clipSpeed, clipTimelineDuration } from '../state/selectors'

// Best-effort audio preview using Web Audio. Proxies are video-only, so audio is
// decoded from the original source File (same availability as export — only this
// session's imports). Everything is wrapped so a failure never breaks playback.
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer | null>()
  private decoding = new Map<string, Promise<AudioBuffer | null>>()
  private active: AudioBufferSourceNode[] = []

  constructor(private getFile: (assetId: string) => File | undefined) {}

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
    return this.ctx
  }

  setVolume(volume: number, muted: boolean): void {
    if (this.master) this.master.gain.value = muted ? 0 : volume
  }

  private async decode(assetId: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(assetId)) return this.buffers.get(assetId) ?? null
    const pending = this.decoding.get(assetId)
    if (pending) return pending
    const ctx = this.ensureCtx()
    const file = this.getFile(assetId)
    if (!ctx || !file) return null
    const p = (async () => {
      try {
        const buf = await file.arrayBuffer()
        const audio = await ctx.decodeAudioData(buf.slice(0))
        this.buffers.set(assetId, audio)
        return audio
      } catch {
        this.buffers.set(assetId, null) // no/undecodable audio — don't retry
        return null
      } finally {
        this.decoding.delete(assetId)
      }
    })()
    this.decoding.set(assetId, p)
    return p
  }

  stop(): void {
    for (const n of this.active) {
      try {
        n.stop()
        n.disconnect()
      } catch {
        /* already stopped */
      }
    }
    this.active = []
  }

  // Schedule all audible clips relative to `playheadSec`. globalRate is the player's
  // playback-speed multiplier. Returns the AudioContext anchor time for sync checks.
  async play(
    project: Project,
    playheadSec: number,
    globalRate: number,
    volume: number,
    muted: boolean,
  ): Promise<void> {
    const ctx = this.ensureCtx()
    if (!ctx || !this.master) return
    try {
      await ctx.resume()
    } catch {
      /* ignore */
    }
    this.stop()
    this.setVolume(volume, muted)

    const rate = globalRate > 0 ? globalRate : 1

    // Decode every needed buffer FIRST. Capturing the schedule anchor before an
    // awaited decode would let a slow first-time decodeAudioData push the anchor
    // into the past, starting clips immediately and desyncing from the video.
    const candidates = Object.values(project.clips).filter((c) => {
      if (!this.getFile(c.assetId)) return false
      return playheadSec < c.startSec + clipTimelineDuration(c)
    })
    const decoded = await Promise.all(
      candidates.map((c) => this.decode(c.assetId)),
    )

    const now = ctx.currentTime + 0.04

    for (let i = 0; i < candidates.length; i++) {
      const clip = candidates[i]
      const buf = decoded[i]
      if (!buf) continue

      const spd = clipSpeed(clip)
      const intoTimeline = Math.max(0, playheadSec - clip.startSec)
      const startDelayTimeline = Math.max(0, clip.startSec - playheadSec)
      const sourceOffset = clip.inSec + intoTimeline * spd
      const sourceRemaining = Math.max(0, clip.outSec - sourceOffset)
      if (sourceRemaining <= 0) continue

      try {
        const node = ctx.createBufferSource()
        node.buffer = buf
        node.playbackRate.value = spd * rate
        const g = ctx.createGain()
        g.gain.value = clip.volume ?? 1
        node.connect(g).connect(this.master)
        node.start(now + startDelayTimeline / rate, sourceOffset, sourceRemaining)
        this.active.push(node)
      } catch {
        /* skip this clip */
      }
    }
  }

  dispose(): void {
    this.stop()
    try {
      void this.ctx?.close()
    } catch {
      /* ignore */
    }
    this.ctx = null
    this.master = null
    this.buffers.clear()
  }
}
