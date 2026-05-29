import { create } from 'zustand'
import { temporal } from 'zundo'
import type {
  AspectRatio,
  AssetId,
  ClipId,
  MediaAsset,
  Project,
  TextOverlay,
  Track,
  TrackId,
} from '../types/timeline'
import { ASPECT_DIMS, PROJECT_DEFAULTS } from '../types/timeline'
import type { ClipFilters } from '../types/filters'
import { DEFAULT_FILTERS } from '../types/filters'
import { makeAssetFromFile, newAssetId, probeFile } from '../media/ingest'
import { generateProxy } from '../media/proxy'
import { clipSpeed, clipTimelineDuration, clipTimelineEnd, totalDurationSec } from './selectors'
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
    aspectRatio: '16:9',
    tracks: [videoTrack, audioTrack],
    clips: {},
    textOverlays: {},
  }
}

export type Selection =
  | { kind: 'clip'; id: ClipId }
  | { kind: 'text'; id: string }
  | null

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
  // Actions — pro (P2+)
  setAspectRatio: (ratio: AspectRatio) => void
  updateClipFilters: (id: ClipId, patch: Partial<ClipFilters>) => void
  setClipFit: (id: ClipId, fit: 'contain' | 'cover') => void
  setClipSpeed: (id: ClipId, speed: number) => void
  setClipTransition: (id: ClipId, kind: 'fade' | 'black' | 'none', durSec: number) => void
  duplicateClip: (id: ClipId) => void
  // Text overlays (P4)
  addTextOverlay: (atSec?: number) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  removeTextOverlay: (id: string) => void
  selectText: (id: string) => void
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

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
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
    // Reset is not an undoable edit — drop history so Ctrl+Z can't resurrect cleared clips.
    useEditorStore.temporal.getState().clear()
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
      // Loading the saved project must not be undoable (would wipe it back to empty).
      useEditorStore.temporal.getState().clear()
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
      const localT = playhead - c.startSec // timeline seconds into the clip
      if (localT <= 0.05 || localT >= clipTimelineDuration(c) - 0.05) continue
      const splitSourceTime = c.inSec + localT * clipSpeed(c)
      // Shorten original. A leading-edge transition stays with the left part only.
      nextClips[id] = { ...c, outSec: splitSourceTime }
      // New right-hand clip (no inherited transition-in at the cut).
      const newId = newAssetId()
      nextClips[newId] = {
        ...c,
        id: newId,
        startSec: c.startSec + localT,
        inSec: splitSourceTime,
        outSec: c.outSec,
        transitionInSec: undefined,
        transitionInKind: undefined,
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
    if (sel?.kind === 'clip') {
      set((s) => {
        const { [sel.id]: _, ...rest } = s.project.clips
        return { project: { ...s.project, clips: rest }, selection: null }
      })
      scheduleSaveProject(get())
    } else if (sel?.kind === 'text') {
      get().removeTextOverlay(sel.id)
    }
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

  setAspectRatio: (ratio) => {
    const dims = ASPECT_DIMS[ratio]
    set((s) => ({
      project: {
        ...s.project,
        aspectRatio: ratio,
        width: dims.width,
        height: dims.height,
      },
    }))
    scheduleSaveProject(get())
  },

  updateClipFilters: (id, patch) => {
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      const filters: ClipFilters = { ...DEFAULT_FILTERS, ...clip.filters, ...patch }
      return {
        project: {
          ...s.project,
          clips: { ...s.project.clips, [id]: { ...clip, filters } },
        },
      }
    })
    scheduleSaveProject(get())
  },

  setClipFit: (id, fit) => {
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      return {
        project: {
          ...s.project,
          clips: { ...s.project.clips, [id]: { ...clip, fit } },
        },
      }
    })
    scheduleSaveProject(get())
  },

  setClipSpeed: (id, speed) => {
    const clamped = Math.max(0.25, Math.min(4, speed))
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      return {
        project: {
          ...s.project,
          clips: { ...s.project.clips, [id]: { ...clip, speed: clamped } },
        },
      }
    })
    scheduleSaveProject(get())
  },

  setClipTransition: (id, kind, durSec) => {
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      const next =
        kind === 'none'
          ? { ...clip, transitionInSec: undefined, transitionInKind: undefined }
          : {
              ...clip,
              transitionInKind: kind,
              transitionInSec: Math.max(0.1, Math.min(3, durSec)),
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

  duplicateClip: (id) => {
    set((s) => {
      const clip = s.project.clips[id]
      if (!clip) return s
      const newId = newAssetId()
      const len = clipTimelineDuration(clip)
      const dup = { ...clip, id: newId, startSec: clip.startSec + len }
      return {
        project: {
          ...s.project,
          clips: { ...s.project.clips, [newId]: dup },
        },
        selection: { kind: 'clip', id: newId },
      }
    })
    scheduleSaveProject(get())
  },

  addTextOverlay: (atSec) => {
    const { playhead, project } = get()
    const start = atSec ?? playhead
    const id = newAssetId()
    const overlay: TextOverlay = {
      id,
      text: 'Your text',
      startSec: start,
      endSec: start + 3,
      x: 0.5,
      y: 0.5,
      fontSize: 0.08,
      color: '#ffffff',
      bg: false,
      align: 'center',
      bold: true,
    }
    set({
      project: {
        ...project,
        textOverlays: { ...(project.textOverlays ?? {}), [id]: overlay },
      },
      selection: { kind: 'text', id },
    })
    scheduleSaveProject(get())
  },

  updateTextOverlay: (id, patch) => {
    set((s) => {
      const cur = s.project.textOverlays?.[id]
      if (!cur) return s
      return {
        project: {
          ...s.project,
          textOverlays: {
            ...(s.project.textOverlays ?? {}),
            [id]: { ...cur, ...patch },
          },
        },
      }
    })
    scheduleSaveProject(get())
  },

  removeTextOverlay: (id) => {
    set((s) => {
      const { [id]: _gone, ...rest } = s.project.textOverlays ?? {}
      return {
        project: { ...s.project, textOverlays: rest },
        selection:
          s.selection?.kind === 'text' && s.selection.id === id
            ? null
            : s.selection,
      }
    })
    scheduleSaveProject(get())
  },

  selectText: (id) => set({ selection: { kind: 'text', id } }),
    }),
    {
      // Track only the serializable document model. Assets, source File handles,
      // decoders and transient UI (playhead/volume/selection) are excluded — so
      // scrubbing never pollutes history and File handles never enter snapshots.
      partialize: (state) => ({ project: state.project }),
      // project is replaced by reference only on real edits, so identical-project
      // sets (e.g. setPlayhead) are skipped.
      equality: (a, b) => a.project === b.project,
      limit: 100,
      // Group a burst of sets (e.g. a clip drag) into ONE undo step by recording
      // the pre-burst state on the leading edge and suppressing the rest.
      handleSet: (record) => {
        let timer: ReturnType<typeof setTimeout> | null = null
        let armed = true
        return ((pastState: unknown) => {
          if (armed) {
            ;(record as (s: unknown) => void)(pastState)
            armed = false
          }
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            armed = true
          }, 300)
        }) as typeof record
      },
    },
  ),
)

function endOfTrack(project: Project, trackId: TrackId): number {
  let end = 0
  for (const c of Object.values(project.clips)) {
    if (c.trackId !== trackId) continue
    const ce = clipTimelineEnd(c)
    if (ce > end) end = ce
  }
  return end
}
