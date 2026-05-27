# Prompt: Random Picker

**File**: pdd/prompts/features/random-picker/22-random-picker.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: 5-app mobile-friendly brainstorm in pdd/context/research/mobile-friendly-app-ideas.md (candidate #4)
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps, now installable as a PWA on iPhone and Android. This is the **Random Picker** at `/random-picker` — a one-app-instead-of-five answer to "Who pays?", "Where do we eat?", "Pick a card." Three taps and you have an answer.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies — `window.crypto.getRandomValues` for unbiased randomness (same approach as Password Generator) + the existing `useLocalStorage` hook + optional `navigator.vibrate` for haptic feedback.

## Task

A single-file mini-app with a top tab switcher exposing five randomizers. All settings persist per-tab and the active tab itself persists. A shared "last 5 results" history per tab is shown collapsed at the foot of each tab.

### Tabs

1. **Coin** — flip-a-coin. Big "Heads" / "Tails" result text (`text-6xl`), big "Flip" button. Brief spin animation on flip (~300ms).
2. **Dice** — 1–10 dice configurable, each die with 4/6/8/10/12/20 sides. Big result shows each die value + total. "Roll" button.
3. **Number** — `min` and `max` integer inputs (defaults 1, 100). Generate a single integer uniformly from `[min, max]`. Big result + "Generate" button.
4. **Pick** — textarea of items (one per line). "Pick one" button shows one selected at random. Does not remove the item from the list.
5. **Shuffle** — same textarea as Pick (independent state). "Shuffle" button shows the shuffled list (Fisher-Yates). Result rendered as a small numbered list.

### Shared per tab

- Big centered result area, `tabular-nums`
- Big primary action button below the result
- History footer: last 5 results, collapsed by default if empty
- All settings persist under `snappet:random-picker:*` keys
- Optional haptic on action: `navigator.vibrate?.(10)`

## Math / randomness

Use `window.crypto.getRandomValues(new Uint32Array(1))` for a single 32-bit integer, then modulo into the desired range. A single `secureRandomInt(min, max)` helper covers all use cases. Modulo bias is negligible at these ranges (max 32-bit source vs ≤ a few hundred outcomes); brief comment notes it.

For shuffle: Fisher-Yates from the end down, picking each swap index via `secureRandomInt(0, i)`.

```ts
function secureRandomInt(min: number, max: number): number
function shuffle<T>(items: T[]): T[]
```

## Output format

### 1. `src/frontend/apps/random-picker/index.tsx`

Default-exported `RandomPicker` component. Layout (`max-w-md mx-auto space-y-4`):

- Header row: title "Random Picker" + subtitle (matches Password Generator / Tip Calculator header styling)
- Segmented tab control: Coin / Dice / Number / Pick / Shuffle (5 buttons, equal width, scrollable on tiny screens)
- Active tab card:
  - Big centered result display (`text-6xl` for coin/number/single die; smaller for multi-die lists)
  - Big primary action button (full width, `h-14`, primary color, `rounded-2xl`, `select-none`)
  - Tab-specific settings (collapsed or inline) below the action
- Collapsible "History" footer per tab (last 5 results, oldest at bottom)

State persisted under:
- `snappet:random-picker:tab` — `'coin' | 'dice' | 'number' | 'pick' | 'shuffle'`
- `snappet:random-picker:dice` — `{ count: number; sides: 4|6|8|10|12|20 }`
- `snappet:random-picker:number` — `{ min: number; max: number }`
- `snappet:random-picker:pickItems` — `string` (raw textarea content)
- `snappet:random-picker:shuffleItems` — `string` (raw textarea content)

Ephemeral (not persisted): current results, history (kept in component state across tab switches via the active tab's local history state, OK if cleared on reload).

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/random-picker',
  label: 'Random Picker',
  description: 'Flip a coin, roll dice, pick from a list, or generate a random number.',
  category: 'Utilities',
  icon: '🎲',
  component: lazy(() => import('../apps/random-picker')),
},
```

## Acceptance criteria

- [ ] Tab switcher persists across reload; settings per tab persist
- [ ] Coin flip shows Heads/Tails with a brief spin animation
- [ ] Dice respect count (1–10) and sides (4/6/8/10/12/20); show per-die values + total
- [ ] Number generates an integer in `[min, max]` inclusive; handles `min > max` gracefully (swap or disable)
- [ ] Pick selects one line from the textarea; does not mutate the list
- [ ] Shuffle returns a Fisher-Yates permutation of the lines, rendered as a numbered list
- [ ] History shows last 5 results per tab; collapsed by default when empty
- [ ] All randomness via `window.crypto.getRandomValues` — never `Math.random()`
- [ ] Optional haptic on action via `navigator.vibrate?.(10)`
- [ ] Works on mobile (375px); primary action button is large and one-thumb hittable
- [ ] Dark mode + focus-visible rings on all interactive elements
- [ ] No `any`; strict TypeScript clean

## Constraints

- TypeScript strict; no `any`
- Tailwind only — no inline styles, no CSS-in-JS
- Single file under `apps/random-picker/index.tsx`
- One shared `secureRandomInt(min, max)` helper; never `Math.random()`
- Use `useLocalStorage` for all persistence — do not roll a new hook
- Functional component with hooks only
- Brief comment near `secureRandomInt` noting the negligible modulo bias trade-off
