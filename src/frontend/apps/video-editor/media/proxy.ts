import type { MediaAsset } from '../types/timeline'
import type { ProxyWorkerInit, ProxyWorkerMessage } from '../types/codec'

export interface ProxyResult {
  proxyPath: string
  durationSec: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
  thumbnailDataUrl?: string
}

export const PROXY_TARGET = {
  width: 1280,
  height: 720,
  bitrate: 2_500_000,
} as const

export async function generateProxy(
  asset: MediaAsset,
  file: File,
  onProgress: (value: number) => void,
): Promise<ProxyResult> {
  return await new Promise<ProxyResult>((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/proxy.worker.ts', import.meta.url),
      { type: 'module' },
    )

    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      worker.terminate()
      fn()
    }

    worker.onmessage = (ev: MessageEvent<ProxyWorkerMessage>) => {
      const msg = ev.data
      switch (msg.type) {
        case 'progress':
          if (msg.assetId === asset.id) onProgress(msg.value)
          break
        case 'done':
          if (msg.assetId === asset.id) {
            finish(() =>
              resolve({
                proxyPath: msg.proxyPath,
                durationSec: msg.durationSec,
                width: msg.width,
                height: msg.height,
                fps: msg.fps,
                hasAudio: msg.hasAudio,
                thumbnailDataUrl: msg.thumbnailDataUrl,
              }),
            )
          }
          break
        case 'error':
          if (msg.assetId === asset.id) {
            finish(() => reject(new Error(msg.message)))
          }
          break
      }
    }
    worker.onerror = (e) =>
      finish(() => reject(new Error(e.message || 'Proxy worker crashed')))

    const init: ProxyWorkerInit = {
      type: 'init',
      assetId: asset.id,
      file,
      targetWidth: PROXY_TARGET.width,
      targetHeight: PROXY_TARGET.height,
      targetBitrate: PROXY_TARGET.bitrate,
    }
    worker.postMessage(init)
  })
}
