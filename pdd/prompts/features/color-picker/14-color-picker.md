# Prompt: Color Picker & Converter

**File**: pdd/prompts/features/color-picker/14-color-picker.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: GitHub issue #7
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Color Picker & Converter at `/color-picker`. It lets users pick or paste a color in any of HEX, RGB, or HSL format and instantly see the value in all three, with a live preview swatch and one-click copy.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies.

## Task

A single-file mini-app that:

1. **Live color picker** — native `<input type="color">` plus three text inputs, one per format. The text inputs auto-detect their format (HEX `#rrggbb`, RGB `rgb(r, g, b)`, HSL `hsl(h, s%, l%)`).
2. **Bidirectional conversion** — typing in any input updates the others live. Invalid input shows an inline error on that input only; the other formats keep showing the last valid value.
3. **Live preview swatch** — large color rectangle showing the current color, plus the text "Foreground readable on this background?" tested with WCAG-style contrast against white and black.
4. **One-click copy** per format — small Copy button per input; "Copied!" confirmation for ~1.5s.
5. **State persistence + Reset** — current color persists; Reset returns to a project-default blue (e.g. `#3b82f6`).

## Color math (no library)

```ts
// All take/return integer channels except HSL which keeps h: 0–360, s/l: 0–100.

function parseHex(input: string): { r: number; g: number; b: number } | null
function parseRgb(input: string): { r: number; g: number; b: number } | null
function parseHsl(input: string): { h: number; s: number; l: number } | null

function rgbToHex({r,g,b}): string                      // '#rrggbb'
function rgbToHsl({r,g,b}): { h: number; s: number; l: number }
function hslToRgb({h,s,l}): { r: number; g: number; b: number }

function formatRgb(c): string                            // 'rgb(255, 87, 51)'
function formatHsl(c): string                            // 'hsl(11, 100%, 60%)'

// Relative luminance per WCAG
function luminance({r,g,b}): number
function contrastRatio(a, b): number                     // ≥ 4.5 = AA on body text
```

Accept both `#rgb` shorthand and `#rrggbb` for HEX. Accept RGB with or without spaces, and HSL with or without `%`.

## Output format

### 1. `src/frontend/apps/color-picker/index.tsx`

Default-exported `ColorPicker` component, single file. Internal state is a single source-of-truth `rgb: { r, g, b }`. The three text inputs hold *drafts*; on blur or change, parse the draft and (if valid) update `rgb` and re-derive all three formatted strings.

Layout (`max-w-2xl mx-auto space-y-6`):
- Header row with title + Reset
- Card containing:
  - Native color picker (`<input type="color">`) styled to be 80×80 px, alongside three rows (HEX, RGB, HSL). Each row has the label, the input, a Copy button.
- Large preview swatch (height ~120 px) with the color as background; inside, two text samples ("Aa" big) — one white, one black — and a small badge per sample showing the contrast ratio (e.g. `4.7:1`).

Tailwind detail:
- Format the contrast badge as `bg-green-100` if ≥ 4.5 else `bg-red-100` (and dark variants).
- Use `style={{ backgroundColor: hex }}` for the swatch — this is the one place inline styles are appropriate (dynamic color), see `conventions.md` exception.

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/color-picker',
  label: 'Color Picker & Converter',
  description: 'Convert between HEX, RGB, and HSL with a live preview and contrast checker.',
  category: 'Developer Tools',
  icon: '🎨',
  component: lazy(() => import('../apps/color-picker')),
}
```

## Acceptance criteria (from issue #7)

- [ ] Converts HEX ↔ RGB ↔ HSL correctly
- [ ] Live swatch updates as color changes
- [ ] Copy to clipboard works for all three formats
- [ ] Works on mobile (375px)
- [ ] State persisted to localStorage + Reset button

## Constraints

- All conversion math is pure functions with no `any`. The component holds only `rgb` + the three draft strings.
- HSL rounded to integers in the output; round-tripping HSL→RGB→HSL must not drift by more than 1 in any channel.
- Inline styles only for `backgroundColor` on the swatch (the rest is Tailwind).
- Dark mode and `focus-visible:` rings on every interactive element.
