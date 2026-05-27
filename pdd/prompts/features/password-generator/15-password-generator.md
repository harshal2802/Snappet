# Prompt: Password Generator

**File**: pdd/prompts/features/password-generator/15-password-generator.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: GitHub issue #8
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Password Generator at `/password-generator`. It produces strong customizable passwords with a live entropy-based strength indicator.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies — uses `window.crypto.getRandomValues` for secure randomness.

## Task

A single-file mini-app that:

1. **Length slider** — 8 to 64 characters with a numeric label
2. **Character-set toggles** — Uppercase, Lowercase, Numbers, Symbols. At least one must be on; if the user turns off the last enabled set, immediately re-enable Lowercase as a fallback (and visually indicate it).
3. **Generated password** displayed prominently in a monospace card with a one-click Copy button (with "Copied!" confirmation for ~1.5s) and a Regenerate button (refreshes with the same settings).
4. **Strength indicator** — entropy in bits, plus a label (Weak < 40, Fair < 60, Strong < 80, Very Strong ≥ 80) and a colored bar that fills proportionally to a max of ~128 bits.
5. **Auto-generate on load and on any setting change** so the displayed password always matches the settings.
6. **Settings persistence + Reset** — length and toggles persist; Reset returns to length 16, all four sets on.

## Math

```ts
// Entropy in bits = length * log2(poolSize)
//   poolSize = sum of enabled set sizes
function entropyBits(length: number, poolSize: number): number

function poolSize(opts: { upper: boolean; lower: boolean; numbers: boolean; symbols: boolean }): number

// Strength label thresholds (in bits)
function strengthLabel(bits: number): 'Weak' | 'Fair' | 'Strong' | 'Very Strong'
```

Generation uses `window.crypto.getRandomValues(new Uint32Array(length))` and maps each value to `pool[v % pool.length]`. Modulo bias is negligible at password lengths and ASCII pool sizes — call out only in a comment.

Character sets:
- `UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'`
- `LOWER = 'abcdefghijklmnopqrstuvwxyz'`
- `NUMBERS = '0123456789'`
- `SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/'`

## Output format

### 1. `src/frontend/apps/password-generator/index.tsx`

Default-exported `PasswordGenerator` component. Layout (`max-w-xl mx-auto space-y-6`):
- Header row with title + Reset
- Big password display card: monospace large text + Copy + Regenerate buttons
- Strength bar: colored fill (red/amber/blue/green by tier) + label + entropy bits
- Settings card: length slider with numeric input, four toggle pills

Settings persisted under `snappet:password-generator:settings` as `{ length, upper, lower, numbers, symbols }`. The generated password itself is NOT persisted — regenerate on load and on any setting change via a `useMemo` keyed on the settings *plus* a `bump` counter (the Regenerate button increments `bump`).

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/password-generator',
  label: 'Password Generator',
  description: 'Generate strong passwords with custom length, character sets, and a live strength meter.',
  category: 'Utilities',
  icon: '🔑',
  component: lazy(() => import('../apps/password-generator')),
}
```

## Acceptance criteria (from issue #8)

- [ ] Password generated immediately on load and on any setting change
- [ ] All toggle combinations produce correct character sets
- [ ] Strength indicator reflects entropy accurately
- [ ] Copy to clipboard works
- [ ] Settings persisted to localStorage + Reset button
- [ ] Works on mobile (375px)
- [ ] Dark mode support

## Constraints

- Use `window.crypto.getRandomValues` — never `Math.random()`. Document the modulo-bias trade-off in a brief comment.
- Never persist the generated password — it should never be on disk.
- Generation must be a pure function so the `useMemo` is safe.
- Static Tailwind class records for the strength tier colors (so the scanner finds them).
- No `any`; dark mode + focus-visible rings everywhere.
