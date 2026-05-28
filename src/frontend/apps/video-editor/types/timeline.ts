export type ClipId = string
export type TrackId = string
export type AssetId = string

export type AssetStatus = 'ingesting' | 'ready' | 'error' | 'missing'

export interface MediaAsset {
  id: AssetId
  name: string
  kind: 'video' | 'image' | 'audio'
  mimeType: string
  sourceBytes: number
  durationSec: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
  proxyPath?: string
  thumbnailDataUrl?: string
  status: AssetStatus
  ingestProgress?: number
  errorMessage?: string
}

export interface Transform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

export interface Clip {
  id: ClipId
  assetId: AssetId
  trackId: TrackId
  startSec: number
  inSec: number
  outSec: number
  transform?: Transform
  volume?: number
}

export interface Track {
  id: TrackId
  kind: 'video' | 'audio' | 'overlay'
  index: number
  muted: boolean
}

export interface Project {
  id: string
  name: string
  fps: number
  width: number
  height: number
  tracks: Track[]
  clips: Record<ClipId, Clip>
}

export const PROJECT_DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const
