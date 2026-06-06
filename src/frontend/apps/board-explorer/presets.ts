import type { FilterState } from './types'

export interface Preset {
  name: string
  filter: FilterState
}

export function upsertPreset(presets: Preset[], name: string, filter: FilterState): Preset[] {
  const others = presets.filter((p) => p.name !== name)
  return [...others, { name, filter }].sort((a, b) => a.name.localeCompare(b.name))
}

export function removePreset(presets: Preset[], name: string): Preset[] {
  return presets.filter((p) => p.name !== name)
}
