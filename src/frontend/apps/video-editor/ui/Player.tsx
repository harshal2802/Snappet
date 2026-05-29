import { useCallback, useEffect, useRef, useState } from 'react'
import PreviewCanvas from '../preview/PreviewCanvas'
import { AudioEngine } from '../preview/AudioEngine'
import { useEditorStore } from '../state/editorStore'
import { formatTimecode, totalDurationSec } from '../state/selectors'

// Element-fullscreen with a vendor-prefixed fallback. iPhone Safari has no element
// fullscreen (only video.webkitEnterFullscreen, which would hide our canvas overlays),
// so when neither exists we fall back to a CSS pseudo-fullscreen (see `pseudo` state).
interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}
interface FsDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2]

export default function Player() {
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const project = useEditorStore((s) => s.project)
  const playhead = useEditorStore((s) => s.playhead)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const volume = useEditorStore((s) => s.volume)
  const muted = useEditorStore((s) => s.muted)
  const playbackRate = useEditorStore((s) => s.playbackRate)
  const loop = useEditorStore((s) => s.loop)

  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const stepFrame = useEditorStore((s) => s.stepFrame)
  const togglePlay = useEditorStore((s) => s.togglePlay)
  const setVolume = useEditorStore((s) => s.setVolume)
  const toggleMute = useEditorStore((s) => s.toggleMute)
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate)
  const toggleLoop = useEditorStore((s) => s.toggleLoop)

  const duration = totalDurationSec(project)

  const [isFs, setIsFs] = useState(false)
  const [pseudoFs, setPseudoFs] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [speedOpen, setSpeedOpen] = useState(false)

  // --- fullscreen ---
  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current as FsElement | null
    if (!el) return
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen()
      } else {
        // iPhone Safari: CSS pseudo-fullscreen keeps canvas overlays visible.
        setPseudoFs(true)
        document.body.style.overflow = 'hidden'
      }
    } catch {
      setPseudoFs(true)
      document.body.style.overflow = 'hidden'
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    const doc = document as FsDocument
    try {
      if (doc.fullscreenElement && doc.exitFullscreen) {
        await doc.exitFullscreen()
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      }
    } catch {
      /* ignore */
    }
    if (pseudoFs) {
      setPseudoFs(false)
      document.body.style.overflow = ''
    }
  }, [pseudoFs])

  const toggleFullscreen = useCallback(() => {
    if (isFs || pseudoFs) void exitFullscreen()
    else void enterFullscreen()
  }, [isFs, pseudoFs, enterFullscreen, exitFullscreen])

  useEffect(() => {
    const onChange = (): void => {
      const doc = document as FsDocument
      const active = !!(doc.fullscreenElement || doc.webkitFullscreenElement)
      setIsFs(active)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // --- auto-hide controls ---
  const pokeControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (useEditorStore.getState().isPlaying) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2500)
    }
  }, [])

  useEffect(() => {
    pokeControls()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [isPlaying, pokeControls])

  // --- audio preview (Web Audio) ---
  useEffect(() => {
    const engine = new AudioEngine((id) =>
      useEditorStore.getState().sourceFiles.get(id),
    )
    let anchorPlayhead = 0
    let anchorWall = 0
    let anchorRate = 1
    const reschedule = (st: ReturnType<typeof useEditorStore.getState>): void => {
      anchorPlayhead = st.playhead
      anchorWall = performance.now()
      anchorRate = st.playbackRate
      void engine.play(st.project, st.playhead, st.playbackRate, st.volume, st.muted)
    }
    const unsub = useEditorStore.subscribe((st, prev) => {
      if (st.volume !== prev.volume || st.muted !== prev.muted) {
        engine.setVolume(st.volume, st.muted)
      }
      if (st.isPlaying && !prev.isPlaying) {
        reschedule(st)
        return
      }
      if (!st.isPlaying && prev.isPlaying) {
        engine.stop()
        return
      }
      if (st.isPlaying) {
        if (st.playbackRate !== prev.playbackRate) {
          reschedule(st)
          return
        }
        const expected =
          anchorPlayhead + ((performance.now() - anchorWall) / 1000) * anchorRate
        if (Math.abs(st.playhead - expected) > 0.3) reschedule(st)
      }
    })
    return () => {
      unsub()
      engine.dispose()
    }
  }, [])

  // --- keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tgt = e.target
      if (
        tgt instanceof HTMLElement &&
        (tgt instanceof HTMLInputElement ||
          tgt instanceof HTMLTextAreaElement ||
          tgt.isContentEditable)
      ) {
        return
      }
      const s = useEditorStore.getState()
      const dur = totalDurationSec(s.project)

      // Modifier combos (undo/redo/duplicate) — handled before single-key shortcuts
      // so e.g. Cmd+S doesn't trigger Split.
      if (e.metaKey || e.ctrlKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault()
          if (e.shiftKey) useEditorStore.temporal.getState().redo()
          else useEditorStore.temporal.getState().undo()
        } else if (e.code === 'KeyY') {
          e.preventDefault()
          useEditorStore.temporal.getState().redo()
        } else if (e.code === 'KeyD') {
          e.preventDefault()
          if (s.selection?.kind === 'clip') s.duplicateClip(s.selection.id)
        }
        return
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault()
          s.togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          s.stepFrame(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          s.stepFrame(1)
          break
        case 'KeyJ':
          e.preventDefault()
          s.setPlaybackRate(Math.max(0.25, s.playbackRate / 2))
          break
        case 'KeyL':
          e.preventDefault()
          s.setPlaybackRate(Math.min(4, s.playbackRate * 2))
          break
        case 'Home':
          e.preventDefault()
          s.setPlayhead(0)
          break
        case 'End':
          e.preventDefault()
          s.setPlayhead(dur)
          break
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'KeyM':
          e.preventDefault()
          s.toggleMute()
          break
        case 'KeyS':
          e.preventDefault()
          s.splitClipAtPlayhead()
          break
        case 'Backspace':
        case 'Delete':
          e.preventDefault()
          s.deleteSelection()
          break
        default:
          break
      }
      pokeControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen, pokeControls])

  const progress = duration > 0 ? Math.min(1, playhead / duration) : 0

  return (
    <div
      ref={containerRef}
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      className={
        'group relative w-full select-none overflow-hidden rounded-lg bg-black shadow-md ' +
        (pseudoFs
          ? 'fixed inset-0 z-[9999] flex items-center justify-center rounded-none'
          : '')
      }
      style={pseudoFs ? { height: '100dvh' } : undefined}
    >
      <div
        className={
          'flex w-full justify-center ' +
          (pseudoFs ? 'h-full items-center' : '')
        }
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        <PreviewCanvas />
      </div>

      {/* Center play indicator when paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-3xl text-white backdrop-blur transition hover:bg-black/60"
        >
          ▶
        </button>
      )}

      {/* Controls bar */}
      <div
        className={
          'absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-white transition-opacity duration-200 ' +
          (controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      >
        {/* Scrub bar */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.0001}
          value={progress}
          onChange={(e) => setPlayhead(Number(e.target.value) * duration)}
          aria-label="Seek"
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-blue-500"
        />

        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="rounded p-1 hover:bg-white/15"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => stepFrame(-1)}
            aria-label="Previous frame"
            title="Previous frame (←)"
            className="rounded p-1 text-xs hover:bg-white/15"
          >
            ⏮|
          </button>
          <button
            onClick={() => stepFrame(1)}
            aria-label="Next frame"
            title="Next frame (→)"
            className="rounded p-1 text-xs hover:bg-white/15"
          >
            |⏭
          </button>

          {/* Volume */}
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="rounded p-1 hover:bg-white/15"
          >
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/30 accent-blue-500 sm:block"
          />

          <span className="ml-1 font-mono text-xs tabular-nums">
            {formatTimecode(playhead)} / {formatTimecode(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* Loop */}
            <button
              onClick={toggleLoop}
              aria-label="Toggle loop"
              title="Loop"
              className={
                'rounded p-1 hover:bg-white/15 ' + (loop ? 'text-blue-400' : '')
              }
            >
              🔁
            </button>

            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => setSpeedOpen((v) => !v)}
                className="rounded px-2 py-1 text-xs font-medium hover:bg-white/15"
                aria-label="Playback speed"
                title="Playback speed (J / L)"
              >
                {playbackRate}×
              </button>
              {speedOpen && (
                <div className="absolute bottom-9 right-0 z-10 overflow-hidden rounded-md bg-gray-900/95 text-xs shadow-lg ring-1 ring-white/10">
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      onClick={() => {
                        setPlaybackRate(sp)
                        setSpeedOpen(false)
                      }}
                      className={
                        'block w-full px-4 py-1.5 text-left hover:bg-white/10 ' +
                        (sp === playbackRate ? 'text-blue-400' : '')
                      }
                    >
                      {sp}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              title="Fullscreen (F)"
              className="rounded p-1 hover:bg-white/15"
            >
              {isFs || pseudoFs ? '🡼' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
