import type { Clip, Project, TextOverlay, Track } from '../types/timeline'

// A clip's duration ON THE TIMELINE accounts for its playback speed:
// faster clips occupy less timeline time. Source span is (outSec - inSec).
export function clipSpeed(clip: Clip): number {
  const s = clip.speed ?? 1
  return s > 0 ? s : 1
}

export function clipTimelineDuration(clip: Clip): number {
  return (clip.outSec - clip.inSec) / clipSpeed(clip)
}

export function clipTimelineEnd(clip: Clip): number {
  return clip.startSec + clipTimelineDuration(clip)
}

export function totalDurationSec(project: Project): number {
  let max = 0
  for (const c of Object.values(project.clips)) {
    const end = clipTimelineEnd(c)
    if (end > max) max = end
  }
  // Text overlays can extend the timeline beyond the last clip.
  for (const t of Object.values(project.textOverlays ?? {})) {
    if (t.endSec > max) max = t.endSec
  }
  return max
}

export function clipsAtTime(
  project: Project,
  time: number,
  trackKind?: Track['kind'],
): Clip[] {
  const trackIds = new Set(
    project.tracks
      .filter((t) => (trackKind ? t.kind === trackKind : true))
      .map((t) => t.id),
  )
  const out: Clip[] = []
  for (const c of Object.values(project.clips)) {
    if (!trackIds.has(c.trackId)) continue
    const end = clipTimelineEnd(c)
    if (time >= c.startSec && time < end) out.push(c)
  }
  // Higher track index = on top.
  out.sort((a, b) => {
    const ta = project.tracks.find((t) => t.id === a.trackId)?.index ?? 0
    const tb = project.tracks.find((t) => t.id === b.trackId)?.index ?? 0
    return ta - tb
  })
  return out
}

export function activeTextOverlays(
  project: Project,
  time: number,
): TextOverlay[] {
  const out: TextOverlay[] = []
  for (const t of Object.values(project.textOverlays ?? {})) {
    if (time >= t.startSec && time < t.endSec) out.push(t)
  }
  return out
}

export function sourceTimeForClip(clip: Clip, time: number): number {
  // Map a timeline time to a source time, scaling by speed (2× clip advances the
  // source twice as fast per timeline second).
  return clip.inSec + (time - clip.startSec) * clipSpeed(clip)
}

export function formatTimecode(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const total = Math.floor(sec * 1000)
  const ms = total % 1000
  const s = Math.floor(total / 1000) % 60
  const m = Math.floor(total / 60000)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms
    .toString()
    .padStart(3, '0')}`
}
