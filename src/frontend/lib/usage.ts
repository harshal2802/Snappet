// Per-device app usage tracking. Snappet is 100% client-side with no backend or
// analytics, so "popularity" = how often THIS user opens each tool, stored locally.
export interface UsageEntry {
  count: number
  last: number // epoch ms of last open
}
export type UsageMap = Record<string, UsageEntry>

const KEY = 'snappet:usage:v1'

export function loadUsage(): UsageMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as UsageMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function save(map: UsageMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* storage unavailable / quota — usage tracking is best-effort */
  }
}

// Normalize a router pathname to a catalog path key ('/video-editor/' → '/video-editor').
export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '')
  return p === '' ? '/' : p
}

export function recordUse(path: string): void {
  const key = normalizePath(path)
  if (key === '/') return // don't count the hub itself
  const map = loadUsage()
  const prev = map[key]
  map[key] = { count: (prev?.count ?? 0) + 1, last: Date.now() }
  save(map)
}

export function clearUsage(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export interface UsageStats {
  totalOpens: number
  toolsUsed: number
}

export function usageStats(map: UsageMap): UsageStats {
  const entries = Object.values(map)
  return {
    totalOpens: entries.reduce((s, e) => s + e.count, 0),
    toolsUsed: entries.filter((e) => e.count > 0).length,
  }
}

// Short relative time: "just now", "5m ago", "3h ago", "2d ago", "Apr 5".
export function relativeTime(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return `${d}d ago`
  }
}
