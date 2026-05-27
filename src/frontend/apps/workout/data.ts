import type { Exercise } from './types'

// Module-level memoization — the JSON is fetched once per page load and
// shared across components.
let cache: Exercise[] | null = null
let inflight: Promise<Exercise[]> | null = null

export async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache
  if (inflight) return inflight
  // Lazy fetch from public/ — deliberately NOT a static import, so the
  // 1 MB JSON stays out of vite-plugin-pwa's precache manifest.
  const url = `${import.meta.env.BASE_URL}exercises.json`
  inflight = fetch(url).then(async (res) => {
    if (!res.ok) {
      inflight = null
      throw new Error(`Failed to load exercises: ${res.status}`)
    }
    const data = (await res.json()) as Exercise[]
    cache = data
    inflight = null
    return data
  })
  return inflight
}

// Image URL helpers — jsdelivr is the primary CDN; we fall back to raw
// githubusercontent on per-image error inside <ExerciseImage>.
const JSDELIVR_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'
const GH_RAW_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export function exerciseImageUrl(
  relPath: string,
  opts: { fallback?: boolean } = {},
): string {
  return opts.fallback ? GH_RAW_BASE + relPath : JSDELIVR_BASE + relPath
}
