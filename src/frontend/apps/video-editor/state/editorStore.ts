import { create } from 'zustand'
import type {
  AssetId,
  ClipId,
  MediaAsset,
  Project,
  Track,
  TrackId,
} from '../types/timeline'
import { PROJECT_DEFAULTS } from '../types/timeline'
import { makeAssetFromFile, newAssetId, probeFile } from '../media/ingest'
import { generateProxy } from '../media/proxy'
import { totalDurationSec } from './selectors'
import {
  clearAll as opfsClearAll,
  deleteFile as opfsDeleteFile,
  listFiles,
  readFile as opfsReadFile,
  writeFile as opfsWriteFile,
} from '../media/opfs'

const ASSETS_META_PATH = 'project/assets.json'
const PROJECT_PATH = 'project/project.json'

function makeDefaultProject(): Project {
  const videoTrack: Track = {
    id: 'track-video-1',
    kind: 'video',
    index: 0,
    muted: false,
  }
  const audioTrack: Track = {
    id: 'track-audio-1',
    kind: 'audio',
    index: 0,
    muted: false,
  }
  return {
    id: newAssetId(),
    name: 'Untitled',
    fps: PROJECT_DEFAULTS.fps,
    width: PROJECT_DEFAULTS.width,
    height: PROJECT_DEFAULTS.height,
    tracks: [videoTrack, audioTrack],
    clips: {},
  }
}

export type Selection = { kind: 'clip'; id: ClipId } | null

interface EditorState {
  // Data
  assets: Record<AssetId, MediaAsset>
  project: Project
  // File handles for assets that have been picked this session.
  // Maps AssetId -> File. Not persisted (Files can't survive a reload on most platforms).
  sourceFiles: Map<AssetId, File>
  // UI
  selection: Selection
  playhead: number
  isPlaying: boolean
  zoomPxPerSec: number
  exportDialogOpen: boolean
  hydrated: boolean
  // Player
  volume: number
  muted: boolean
  playbackRate: number
  loop: boolean
  // Actions — M1
  ingestFiles: (files: FileList | File[]) => Promise<void>
  removeAsset: (id: AssetId) => Promise<void>
  relinkAsset: (id: AssetId, file: File) => Promise<void>
  resetAll: () => Promise<void>
  rehydrateFromOpfs: () => Promise<void>
  registerSourceFile: (id: AssetId, file: File) => void
  // Actions — M2
  addClipFromAsset: (assetId: AssetId, atSec?: number) => void
  moveClip: (id: ClipId, newStartSec: number) => void
  trimClip: (id: ClipId, edge: 'in' | 'out', newSec: number) => void
  splitClipAtPlayhead: () => void
  deleteSelection: () => void
  selectClip: (id: ClipId | null) => void
  setPlayhead: (sec: number) => void
  stepFrame: (dir: 1 | -1) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setZoom: (pxPerSec: number) => void
  setExportDialogOpen: (open: boolean) => void
  // Player actions
  setVolume: (v: number) => void
  toggleMute: () => void
  setPlaybackRate: (r: number) => void
  toggleLoop: () => void
}

// --- persistence ---

let saveAssetsTimer: ReturnType<typeof setTimeout> | null = null
let saveProjectTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSaveAssets(state: EditorState): void {
  if (saveAssetsTimer) clearTimeout(saveAssetsTimer)
  saveAssetsTimer = setTimeout(() => {
    const serializable = Object.values(state.assets).map((a) => ({
      ...a,
      // Don't persist transient ingest progress.
      ingestProgress: undefined,
      errorMessage: undefined,
    }))
    const json = JSON.stringify(serializable, null, 2)
    opfsWriteFile(ASSETS_META_PATH, new TextEncoder().encode(json)).catch(() => {
      /* OPFS quota or eviction; ignore */
    })
  }, 300)
}

function scheduleSaveProject(state: EditorState): void {
  if (saveProjectTimer) clearTimeout(saveProjectTimer)
  saveProjectTimer = setTimeout(() => {
    const json = JSON.stringify(state.project, null, 2)
    opfsWriteFile(PROJECT_PATH, new TextEncoder().encode(json)).catch(() => {
      /* ignore */
    })
  }, 300)
}

export const useEditorStore = create<EditorState>((set, get) => ({
  assets: {},
  project: makeDefaultProject(),
  sourceFiles: new Map(),
  selection: null,
  playhead: 0,
  isPlaying: false,
  zoomPxPerSec: 100,
  exportDialogOpen: false,
  hydrated: false,
  volume: 1,
  muted: false,
  playbackRate: 1,
  loop: false,

  ingestFiles: async (filesIn) => {
    const files = Array.from(filesIn)
    const newAssets: MediaAsset[] = []
    for (const file of files) {
      try {
        const probe = await probeFile(file)
        const asset = makeAssetFromFile(file, probe)
        newAssets.push(asset)
        set((s) => {
          const sf = new Map(s.sourceFiles)
          sf.set(asset.id, file)
          return {
            assets: { ...s.assets, [asset.id]: asset },
            sourceFiles: sf,
          }
        })
      } catch (e) {
        // Probe failed — still create a record so the user sees the failure.
        const asset: MediaAsset = {
          id: newAssetId(),
          name: file.name,
          kind: 'video',
          mimeType: file.type,
          sourceBytes: file.size,
          durationSec: 0,
          width: 0,
          height: 0,
          fps: 30,
          hasAudio: false,
          status: 'error',
          errorMessage: (e as Error).message,
        }
        set((s) => ({ assets: { ...s.assets, [asset.id]: asset } }))
      }
    }

    // Generate proxies sequentially so we don't blow up GPU/CPU.
    for (const asset of newAssets) {
      const file = get().sourceFiles.get(asset.id)
      if (!file) continue
      try {
        const result = await generateProxy(asset, file, (pct) => {
          set((s) => ({
            assets: {
              ...s.assets,
              [asset.id]: { ...s.assets[asset.id], ingestProgress: pct },
            },
          }))
        })
        set((s) => ({
          assets: {
            ...s.assets,
            [asset.id]: {
              ...s.assets[asset.id],
              status: 'ready',
              ingestProgress: 1,
              proxyPath: result.proxyPath,
              thumbnailDataUrl: result.thumbnailDataUrl,
              // Trust the proxy's measurements if probe missed them.
              durationSec: s.assets[asset.id].durationSec || result.durationSec,
              fps: s.assets[asset.id].fps || result.fps,
              hasAudio: s.assets[asset.id].hasAudio || result.hasAudio,
            },
          },
        }))
        scheduleSaveAssets(get())
      } catch (e) {
        set((s) => ({
          assets: {
            ...s.assets,
            [asset.id]: {
              ...s.assets[asset.id],
              status: 'error',
              errorMessage: (e as Error).message,
            },
          },
        }))
      }
    }
  },

  removeAsset: async (id) => {
    const a = get().assets[id]
    if (a?.proxyPath) {
      await opfsDeleteFile(a.proxyPath).catch(() => undefined)
    }
    set((s) => {
      const { [id]: _removed, ...rest } = s.assets
      const sf = new Map(s.sourceFiles)
      sf.delete(id)
      // Also remove any clips referencing this asset.
      const clips = Object.fromEntries(
        Object.entries(s.project.clips).filter(([, c]) => c.assetId !== id),
      )
      return {
        assets: rest,
        sourceFiles: sf,
        project: { ...s.project, clips },
        selection:
          s.selection?.kind === 'clip' && !clips[s.selection.id]
            ? null
            : s.selection,
      }
    })
    scheduleSaveAssets(get())
    scheduleSaveProject(get())
  },

  relinkAsset: async (id, file) => {
    set((s) => {
      const sf = new Map(s.sourceFiles)
      sf.set(id, file)
      const asset = s.assets[id]
      if (!asset) return s
      return {
        sourceFiles: sf,
        assets: {
          ...s.assets,
          [id]: { ...asset, status: asset.proxyPath ? 'ready' : 'ingesting' },
        },
      }
    })
  },

  resetAll: async () => {
    await opfsClearAll().catch(() => undefined)
    set({
      assets: {},
      project: makeDefaultProject(),
      sourceFiles: new Map(),
      selection: null,
      playhead: 0,
      isPlaying: false,
    })
  },

  rehydrateFromOpfs: async () => {
    if (get().hydrated) return
    try {
      const proxyFiles = await listFiles('proxies')
      const proxyIds = new Set(proxyFiles.map((n) => n.replace(/\.mp4$/i, '')))
      let assets: Record<AssetId, MediaAsset> = {}
      try {
        const blob = await opfsReadFile(ASSETS_META_PATH)
        const text = await blob.text()
        const arr = JSON.parse(text) as MediaAsset[]
        for (const a of arr) {
          // If proxy still exists, treat as 'missing' (need re-link for original);
          // editor can still preview from proxy.
          assets[a.id] = {
            ...a,
            status: proxyIds.has(a.id) ? 'missing' : 'error',
            errorMessage: proxyIds.has(a.id)
              ? 'Re-link the original to enable export.'
              : 'Proxy missing — re-import the file.',
          }
        }
      } catch {
        assets = {}
      }
      let project = makeDefaultProject()
      try {
        const blob = await opfsReadFile(PROJECT_PATH)
        const text = await blob.text()
        project = JSON.parse(text) as Project
      } catch {
        /* keep default */
      }
      set({ assets, project, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  registerSourceFile: (id, file) => {
    set((s) => {
      const sf = new Map(s.sourceFiles)
      sf.set(id, file)
      return { sourceFiles: sf }
    })
  },

  // --- M2 actions ---

  addClipFromAsset: (assetId, atSec) => {
    const asset = get().assets[assetId]
    if (!asset || asset.durationSec <= 0) return
    const videoTrack = get().project.tracks.find((t) => t.kind === 'video')
    if (!videoTrack) return
    const startSec = atSec ?? endOfTrack(get().project, videoTrack.id)
    const clipId = newAssetId()
    set((s) => ({
      project: {
        ...s.project,
        clips: {
          ...s.project.clips,
          [clipId]: {
            id: clipId,
            assetId,
            trackId: videoTrack.id,
            startSec,
            inSec: 0,
            outSec: asset.durationSec,
          },
        },
      },
      selection: { kind: 'clip', id: clipId },
    }))
    scheduleSaveProject(get())
  },

  moveClip: (id, newStartSec) => {
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      const clamped = Math.max(0, newStartSec)
      return {
        project: {
          ...s.project,
          clips: { ...s.project.clips, [id]: { ...clip, startSec: clamped } },
        },
      }
    })
    scheduleSaveProject(get())
  },

  trimClip: (id, edge, newSec) => {
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      const asset = s.assets[clip.assetId]
      if (!asset) return s
      const next = { ...clip }
      const MIN = 0.05
      if (edge === 'in') {
        next.inSec = Math.max(0, Math.min(newSec, clip.outSec - MIN))
      } else {
        next.outSec = Math.max(clip.inSec + MIN, Math.min(newSec, asset.durationSec))
      }
      return {
        project: {
          ...s.project,
          clips: { ...s.project.clips, [id]: next },
        },
      }
    })
    scheduleSaveProject(get())
  },

  splitClipAtPlayhead: () => {
    const { playhead, project, selection } = get()
    const candidates = selection?.kind === 'clip' ? [selection.id] : Object.keys(project.clips)
    let changed = false
    const nextClips = { ...project.clips }
    for (const id of candidates) {
      const c = nextClips[id]
      if (!c) continue
      const localT = playhead - c.startSec
      if (localT <= 0.05 || localT >= c.outSec - c.inSec - 0.05) continue
      const splitSourceTime = c.inSec + localT
      // Shorten original.
      nextClips[id] = { ...c, outSec: splitSourceTime }
      // New right-hand clip.
      const newId = newAssetId()
      nextClips[newId] = {
        ...c,
        id: newId,
        startSec: c.startSec + localT,
        inSec: splitSourceTime,
        outSec: c.outSec,
      }
      changed = true
    }
    if (changed) {
      set((s) => ({ project: { ...s.project, clips: nextClips } }))
      scheduleSaveProject(get())
    }
  },

  deleteSelection: () => {
    const sel = get().selection
    if (sel?.kind !== 'clip') return
    set((s) => {
      const { [sel.id]: _, ...rest } = s.project.clips
      return {
        project: { ...s.project, clips: rest },
        selection: null,
      }
    })
    scheduleSaveProject(get())
  },

  selectClip: (id) => set({ selection: id ? { kind: 'clip', id } : null }),

  setPlayhead: (sec) => set({ playhead: Math.max(0, sec) }),
  stepFrame: (dir) => {
    const { playhead, project } = get()
    const fps = project.fps || 30
    const dur = totalDurationSec(project)
    const next = Math.max(0, Math.min(dur, playhead + dir / fps))
    set({ playhead: next, isPlaying: false })
  },
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setZoom: (px) => set({ zoomPxPerSec: Math.max(10, Math.min(800, px)) }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)), muted: v <= 0 }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setPlaybackRate: (r) => set({ playbackRate: Math.max(0.25, Math.min(4, r)) }),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
}))

function endOfTrack(project: Project, trackId: TrackId): number {
  let end = 0
  for (const c of Object.values(project.clips)) {
    if (c.trackId !== trackId) continue
    const ce = c.startSec + (c.outSec - c.inSec)
    if (ce > end) end = ce
  }
  return end
}
