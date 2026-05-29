// Per-clip color filters. Values use CSS-filter semantics (1 = neutral) so the
// SAME definition drives both the preview (canvas element `style.filter`) and the
// export (2D `ctx.filter`) — guaranteeing WYSIWYG with no shader/2D divergence.

export type FilterLook =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'fade'
  | 'vintage'

export interface ClipFilters {
  brightness: number // 0–2, 1 neutral
  contrast: number // 0–2, 1 neutral
  saturation: number // 0–2, 1 neutral
  look: FilterLook
}

export const DEFAULT_FILTERS: ClipFilters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  look: 'none',
}

export const LOOKS: Array<{ id: FilterLook; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'bw', label: 'B&W' },
  { id: 'fade', label: 'Fade' },
  { id: 'vintage', label: 'Vintage' },
]

function lookCss(look: FilterLook): string {
  switch (look) {
    case 'vivid':
      return 'saturate(1.4) contrast(1.12)'
    case 'warm':
      return 'sepia(0.3) saturate(1.25)'
    case 'cool':
      return 'saturate(0.85) brightness(1.03) hue-rotate(-12deg)'
    case 'bw':
      return 'grayscale(1) contrast(1.05)'
    case 'fade':
      return 'contrast(0.85) brightness(1.08) saturate(0.85)'
    case 'vintage':
      return 'sepia(0.45) contrast(1.08) saturate(0.9)'
    case 'none':
    default:
      return ''
  }
}

export function toCssFilter(f?: ClipFilters | null): string {
  if (!f) return 'none'
  const base = `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation})`
  const extra = lookCss(f.look)
  const s = extra ? `${base} ${extra}` : base
  return s
}

export function isNeutralFilter(f?: ClipFilters | null): boolean {
  if (!f) return true
  return (
    f.brightness === 1 &&
    f.contrast === 1 &&
    f.saturation === 1 &&
    f.look === 'none'
  )
}
