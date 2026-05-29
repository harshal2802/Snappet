import type { useEditorStore } from '../state/editorStore'
import { clipsAtTime, sourceTimeForClip, totalDurationSec } from '../state/selectors'
import { Compositor } from './Compositor'
import { DecoderPool } from './DecoderPool'
import { readFile as opfsReadFile } from '../media/opfs'

type Store = typeof useEditorStore

export class Renderer {
  private rafId: number | null = null
  private compositor: Compositor
  private pool: DecoderPool
  private lastFrameTime = 0
  private rendering = false
  private disposed = false

  constructor(
    gl: WebGL2RenderingContext,
    private canvas: HTMLCanvasElement,
    private store: Store,
  ) {
    this.compositor = new Compositor(gl)
    this.pool = new DecoderPool(async (assetId) => {
      const asset = store.getState().assets[assetId]
      if (!asset?.proxyPath) return undefined
      try {
        return await opfsReadFile(asset.proxyPath)
      } catch {
        return undefined
      }
    })
  }

  start(): void {
    this.lastFrameTime = performance.now()
    this.loop()
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  renderOnce(): void {
    void this.renderFrame()
  }

  private loop = (): void => {
    if (this.disposed) return
    const state = this.store.getState()
    if (state.isPlaying) {
      const now = performance.now()
      const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000) // cap 100ms
      this.lastFrameTime = now
      const dur = totalDurationSec(state.project)
      const next = state.playhead + dt * state.playbackRate
      if (dur > 0 && next >= dur) {
        if (state.loop) {
          state.setPlayhead(0)
        } else {
          state.setPlayhead(dur)
          state.pause()
        }
      } else {
        state.setPlayhead(next)
      }
    } else {
      this.lastFrameTime = performance.now()
    }
    void this.renderFrame()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private async renderFrame(): Promise<void> {
    if (this.rendering || this.disposed) return
    this.rendering = true
    try {
      const state = this.store.getState()
      const w = this.canvas.width
      const h = this.canvas.height
      const active = clipsAtTime(state.project, state.playhead, 'video')
      if (active.length === 0) {
        this.compositor.clear(w, h)
        return
      }
      // M2: render the topmost video clip only.
      const top = active[active.length - 1]
      const t = sourceTimeForClip(top, state.playhead)
      const frame = await this.pool.getFrame(top.assetId, t)
      if (!frame) {
        this.compositor.clear(w, h)
        return
      }
      try {
        this.compositor.draw(frame, w, h)
      } finally {
        frame.close()
      }
    } finally {
      this.rendering = false
    }
  }

  dispose(): void {
    this.disposed = true
    this.stop()
    this.pool.disposeAll()
    this.compositor.dispose()
  }
}
