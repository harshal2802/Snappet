export interface EncodedVideoChunkMessage {
  type: 'key' | 'delta'
  timestamp: number
  duration?: number
  data: Uint8Array
}

export interface ProxyWorkerInit {
  type: 'init'
  assetId: string
  file: File
  targetWidth: number
  targetHeight: number
  targetBitrate: number
}

export type ProxyWorkerMessage =
  | { type: 'progress'; assetId: string; value: number }
  | {
      type: 'done'
      assetId: string
      proxyPath: string
      durationSec: number
      width: number
      height: number
      fps: number
      hasAudio: boolean
      thumbnailDataUrl?: string
    }
  | { type: 'error'; assetId: string; message: string }
