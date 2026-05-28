import type { Exercise } from './types'

// Strip a common English suffix. Returns the stem if a rule applies, otherwise
// the original token. We require a minimum remaining length so we don't chop
// short tokens (e.g. "as", "is") into something meaningless.
export function stem(word: string): string {
  const w = word.toLowerCase()
  if (w.length >= 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length >= 4 && w.endsWith('ed')) return w.slice(0, -2)
  if (w.length >= 4 && w.endsWith('es')) return w.slice(0, -2)
  if (w.length >= 4 && w.endsWith('s')) return w.slice(0, -1)
  // Fixes "inclined" → "incline" (the bug the user reported).
  if (w.length >= 4 && w.endsWith('d')) return w.slice(0, -1)
  return w
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// Collect every searchable token for an exercise: name, primary + secondary
// muscles, equipment, category. We stem once at index time so the per-query
// cost stays tiny.
export function buildSearchBag(ex: Exercise): string[] {
  const text = [
    ex.name,
    ex.primaryMuscles.join(' '),
    ex.secondaryMuscles.join(' '),
    ex.equipment,
    ex.category,
  ].join(' ')
  const set = new Set<string>()
  for (const t of tokenize(text)) set.add(stem(t))
  return Array.from(set)
}

// Every stemmed query token must be a prefix of SOME bag token. Prefix match
// (not equality) lets "press" match "pressing" etc., and lets a partial
// "inclin" find "incline".
export function matchesQuery(bag: string[], query: string): boolean {
  const trimmed = query.trim()
  if (trimmed === '') return true
  const queryStems = tokenize(trimmed).map(stem)
  if (queryStems.length === 0) return true
  return queryStems.every((qs) => bag.some((bt) => bt.startsWith(qs)))
}
