import type { Clip, Project, Track } from '../types/timeline'

export function totalDurationSec(project: Project): number {
  let max = 0
  for (const c of Object.values(project.clips)) {
    const end = c.startSec + (c.outSec - c.inSec)
    if (end > max) max = end
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
    const end = c.startSec + (c.outSec - c.inSec)
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

export function sourceTimeForClip(clip: Clip, time: number): number {
  return clip.inSec + (time - clip.startSec)
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
