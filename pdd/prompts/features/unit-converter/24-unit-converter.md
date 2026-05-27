# Prompt: Unit Converter

**File**: pdd/prompts/features/unit-converter/24-unit-converter.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: pdd/context/research/mobile-friendly-app-ideas.md (candidate #5)
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Unit Converter at `/unit-converter`. It converts values bidirectionally between units across seven categories (Length, Weight, Temperature, Volume, Speed, Time, Data), with quick-swap presets for common conversions.

This is the 5th and final app of the mobile-friendly batch from `pdd/context/research/mobile-friendly-app-ideas.md` — useful for traveling (km↔mi), cooking (cups↔ml), groceries (oz↔g), tech (KB↔KiB).

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies — pure math + small typed conversion tables.

## Task

A single-file mini-app that:

1. **Category selector** (segmented pills) — Length, Weight, Temperature, Volume, Speed, Time, Data
2. **From / To** unit dropdowns plus two number inputs
3. **Bidirectional** — typing in either input re-derives the other. A `lastEdited` ref tracks which side drives conversion, preventing feedback loops.
4. **Swap button** (↕) between the two rows — swaps the units (and the values follow)
5. **Quick presets** below — 2–3 common pairs per category (e.g. Length: km↔mi, cm↔in; Temperature: °C↔°F; Volume: cups↔ml)
6. Inputs use `inputmode="decimal"` for the right mobile keypad
7. Last category + selected units persist under `snappet:unit-converter:*` keys via `useLocalStorage`
8. Number formatting: up to 6 significant digits, strip trailing zeros, `toLocaleString()` for whole numbers

## Math

Use **base units per category**. Linear units multiply by a factor `toBase`; Temperature uses explicit functions.

```ts
type Category = 'length' | 'weight' | 'temperature' | 'volume' | 'speed' | 'time' | 'data'

interface LinearUnit {
  label: string
  symbol: string
  toBase: number   // multiply value by toBase to get value in the base unit
}

interface TempUnit {
  label: string
  symbol: string
  toCelsius: (v: number) => number
  fromCelsius: (v: number) => number
}

// Pure conversion function:
function convert(value: number, from: Unit, to: Unit, category: Category): number
// linear:      value * from.toBase / to.toBase
// temperature: toUnit.fromCelsius(fromUnit.toCelsius(value))
```

### Categories and units

- **Length** (base: meter): m, km, cm, mm, mi, yd, ft, in
- **Weight** (base: gram): g, kg, mg, lb, oz
- **Temperature**: °C, °F, K (explicit functions)
- **Volume** (base: liter): L, mL, gal (US), qt (US), pt (US), cup (US 240 mL), fl oz (US), tbsp, tsp
- **Speed** (base: m/s): m/s, km/h, mph, knot
- **Time** (base: second): s, min, hr, day, week
- **Data** (base: byte): B, KB, MB, GB, TB, KiB, MiB, GiB, TiB — decimal (KB = 1000) vs binary (KiB = 1024) distinctly labeled

## Output format

### 1. `src/frontend/apps/unit-converter/index.tsx`

Default-exported `UnitConverter` component. Layout `max-w-md mx-auto space-y-4`:

- Header row with title + description
- Category pills (wrap on mobile)
- Card containing: From row (input + unit select), Swap button, To row (input + unit select)
- Quick-preset chips: 2–3 per category
- Persistence under `snappet:unit-converter:category`, `snappet:unit-converter:from:<category>`, `snappet:unit-converter:to:<category>`, `snappet:unit-converter:value`

A `lastEdited` ref (`'from' | 'to'`) tracks which side drives conversion. On mount and whenever category/units change, recompute the *other* side based on the *edited* side's value.

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/unit-converter',
  label: 'Unit Converter',
  description: 'Convert length, weight, temperature, volume, speed, time, and data.',
  category: 'Calculators',
  icon: '📐',
  component: lazy(() => import('../apps/unit-converter')),
}
```

## Acceptance criteria

- [ ] Each category round-trips: converting A→B then B→A returns to A within 1e-9 for linear units (float-precision aware)
- [ ] Temperature edge cases: 0°C ⇔ 32°F, -40°C = -40°F, 100°C = 212°F, 273.15K = 0°C
- [ ] Data: 1 KB = 1000 B; 1 KiB = 1024 B; 1 MB = 1,000,000 B; 1 MiB = 1,048,576 B
- [ ] Swap button swaps unit selections (values follow)
- [ ] Quick presets jump straight to a sensible pair
- [ ] Last category + units + value persisted across reloads
- [ ] `inputmode="decimal"` triggers the right mobile keypad
- [ ] Works at 375px mobile width
- [ ] Dark mode + focus-visible rings

## Constraints

- TypeScript strict; no `any`. Conversion tables fully typed (`LinearUnit` / `TempUnit`).
- The `convert()` function is pure (referentially transparent) so it's safe inside `useMemo` or render.
- Bidirectional editing must not feedback-loop — guard with the `lastEdited` ref.
- Round-trip precision: linear units within 1e-9; temperature within 1e-9 absolute.
- Tailwind only; no inline styles, no CSS-in-JS.
- Functional component only; dark mode + focus-visible rings.
