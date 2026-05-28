export interface Capabilities {
  webCodecs: boolean
  videoDecoder: boolean
  videoEncoder: boolean
  audioDecoder: boolean
  audioEncoder: boolean
  opfs: boolean
  worker: boolean
  share: boolean
  shareFiles: boolean
  fileSystemAccess: boolean
}

let cached: Capabilities | null = null

export function detectCapabilities(): Capabilities {
  if (cached) return cached
  const w = window as unknown as Record<string, unknown>
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }

  const videoDecoder = typeof w.VideoDecoder === 'function'
  const videoEncoder = typeof w.VideoEncoder === 'function'
  const audioDecoder = typeof w.AudioDecoder === 'function'
  const audioEncoder = typeof w.AudioEncoder === 'function'
  const webCodecs = videoDecoder && videoEncoder

  // OPFS: navigator.storage.getDirectory exists in Chrome/Edge/Safari 15.2+/FF 111+.
  const opfs =
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'

  const worker = typeof Worker === 'function'
  const share = typeof nav.share === 'function'
  let shareFiles = false
  if (share && typeof nav.canShare === 'function') {
    try {
      const probe = new File(['x'], 'probe.txt', { type: 'text/plain' })
      shareFiles = nav.canShare({ files: [probe] })
    } catch {
      shareFiles = false
    }
  }
  const fileSystemAccess = typeof w.showSaveFilePicker === 'function'

  cached = {
    webCodecs,
    videoDecoder,
    videoEncoder,
    audioDecoder,
    audioEncoder,
    opfs,
    worker,
    share,
    shareFiles,
    fileSystemAccess,
  }
  return cached
}

export function isEditorSupported(c: Capabilities): boolean {
  return c.videoDecoder && c.videoEncoder && c.opfs && c.worker
}
