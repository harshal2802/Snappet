# Prompt: Tally Counter

**File**: pdd/prompts/features/tally-counter/21-tally-counter.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: 5-app mobile-friendly brainstorm in pdd/context/research/mobile-friendly-app-ideas.md (candidate #2)
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps, now installable as a PWA on iPhone and Android. This is the **Tally Counter** at `/tally-counter` — the platonic phone-native tool. Tap a giant + button to count things in the physical world (queue length, pull-ups, parking spaces, bird-watching). One-thumb operable.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, React Router v6, Vite. No new dependencies — pure React state + the existing `useLocalStorage` hook + optional `navigator.vibrate` for haptic feedback.

## Task

A single-file mini-app that supports multiple named counters with a giant-tap-target UX:

1. **Multiple named counters**, persisted as `{ id, name, value }[]`. One is the "active" counter, persisted separately by id.
2. **Giant + button** — at least ~50% of the screen height on mobile, full-width, rounded, primary color. The dominant element of the screen so a user can tap one-handed without looking.
3. **HUGE number display** — `text-7xl`/`text-8xl`, `tabular-nums`, centered, formatted with `toLocaleString()` (so 1234 renders as `1,234`).
4. **Editable counter name** — tap the name at the top to rename inline. Enter or blur commits.
5. **Smaller − button** below the + (e.g. `h-16`), and a small "Reset to 0" link.
6. **Counter switcher pills** — a thin row at the bottom: one pill per saved counter (highlighted if active) + a "+" pill to add a new counter. Tap a pill to switch. Each pill has a tiny × to delete it (with confirm; minimum one counter must remain).
7. **Header Reset** — clears the active counter to 0 (does not delete). A separate "Reset all" link clears every counter to 0.
8. **Optional haptic** — `navigator.vibrate?.(10)` on each tap. Android-only in practice; iOS Safari ignores. Use optional chaining so it's a no-op where unsupported.

## Output format

### 1. `src/frontend/apps/tally-counter/index.tsx`

Default-exported `TallyCounter` component. Layout (`max-w-md mx-auto space-y-4`):

- Header row: title "Tally Counter" + subtitle + Reset button (matches Password Generator / Expense Splitter header styling).
- Active counter card containing:
  - Editable counter name (becomes an `<input>` on tap)
  - Big number display (`text-7xl` or `text-8xl`, `tabular-nums`, `aria-live="polite"`)
  - Giant + button (`h-[40vh]`, `w-full`, primary color, `rounded-3xl`, `select-none`)
  - Smaller − button (`h-16 w-full`)
  - Small "Reset to 0" text-link
- Counter pills row: horizontal scroll/wrap, one pill per counter with a × to delete, plus a "+" pill
- "Reset all" link/button at the bottom

State persisted under:
- `snappet:tally-counter:counters` — `{ id: string; name: string; value: number }[]`
- `snappet:tally-counter:activeId` — `string`

Default on first load: a single counter `{ id, name: 'Counter', value: 0 }`, active.

### 2. `src/frontend/router/routes.tsx` (append)

```ts
{
  path: '/tally-counter',
  label: 'Tally Counter',
  description: 'Count things on the go with a giant tap-anywhere counter.',
  category: 'Utilities',
  icon: '🔢',
  component: lazy(() => import('../apps/tally-counter')),
},
```

## Acceptance criteria

- [ ] Tapping + increments the active counter; tapping − decrements (clamped at 0 — never goes negative)
- [ ] Number formats with thousand separators
- [ ] Counter name editable inline (tap, type, Enter or blur to commit; empty falls back to previous name)
- [ ] Pills row switches active counter; "+" pill adds a new counter named e.g. "Counter 2"
- [ ] Deleting a counter prompts confirm; minimum one counter must remain
- [ ] Header Reset zeroes the active counter only
- [ ] "Reset all" zeroes every counter
- [ ] Counters + active id survive a page reload
- [ ] Works on mobile (375px); + button dominates the viewport for one-thumb use
- [ ] Dark mode + focus-visible rings on all interactive elements
- [ ] `aria-live="polite"` on the number so screen readers announce changes
- [ ] No `any`; strict TypeScript clean

## Constraints

- TypeScript strict; no `any` (use `unknown` or proper types)
- Tailwind only — no inline styles, no CSS-in-JS
- Single file under `apps/tally-counter/index.tsx`
- Haptic via `navigator.vibrate?.(10)` (optional chaining — silent no-op on unsupported browsers)
- `select-none` on the giant + button so double-taps don't select adjacent text
- Use `useLocalStorage` for persistence — do not roll a new hook
- Functional component with hooks only
