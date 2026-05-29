import type { ClipFilters } from './filters'

export type ClipId = string
export type TrackId = string
export type AssetId = string

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '4:3'

export interface TextOverlay {
  id: string
  text: string
  startSec: number
  endSec: number
  // Normalized 0–1 canvas coordinates (center anchor) for WYSIWYG across resolutions.
  x: number
  y: number
  fontSize: number // fraction of canvas height (e.g. 0.08)
  color: string
  bg: boolean // semi-opaque backing plate for legibility
  align: 'left' | 'center' | 'right'
  bold: boolean
}

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
  filters?: ClipFilters
  fit?: 'contain' | 'cover'
  speed?: number // playback speed multiplier, 1 = normal
  transitionInSec?: number // crossfade/fade duration on this clip's leading edge
  transitionInKind?: 'fade' | 'black'
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
  aspectRatio?: AspectRatio
  tracks: Track[]
  clips: Record<ClipId, Clip>
  textOverlays?: Record<string, TextOverlay>
}

export const PROJECT_DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const

// Canonical pixel dimensions per aspect preset (1080 on the short side, except 16:9/4:3
// which use 1080 tall). These are the "stage" resolution; preview is a CSS-scaled view.
export const ASPECT_DIMS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '4:3': { width: 1440, height: 1080 },
}

export const ASPECT_PRESETS: Array<{ id: AspectRatio; label: string }> = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '4:3', label: '4:3' },
]
