# Prompt: Touch multi-word selection — long-press → drag in OcrTextView

**File**: pdd/prompts/features/mobile/19-touch-multi-select.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: User report — multi-word selection too hard on iPhone Safari
**Research**: `pdd/context/research/touch-multi-select.md`
**Plan**: `pdd/prompts/features/mobile/PLAN-touch-multi-select.md`
**Depends on**: `pdd/prompts/features/mobile/18-mobile-touch-fixes.md` (the pointer-event refactor of OcrTextView)

## Context

PR #23 swapped OcrTextView's mouse events for pointer events but explicitly punted on touch multi-select. On mobile the only multi-word entry paths (shift+click, ⌘/Ctrl+click) are unreachable. This prompt adds iOS-native long-press-then-drag selection: press and hold a word for 300 ms to enter extend mode, then drag the finger across other words; lift to commit.

**Stack**: React 18, TypeScript (strict), Tailwind CSS. No new deps. Localized to one file.

## Architecture

Reuses the existing `dragAnchorRef` + `rangeBetween` machinery. Only the entry gesture and a state-driven CSS guard are new.

```
onPointerDown(word, e)
├── (shared) preventDefault + shift/meta/ctrl branches (unchanged)
├── (shared) set dragAnchorRef = word.id, onSetSelection([word.id])
└── if pointerType !== 'mouse':
      schedule long-press timer (300ms) — on fire → setIsExtending(true)

useEffect on [isExtending, …] — global pointer handlers:
├── pointermove
│   ├── if long-press timer pending: cancel if movement > 8px (it was a scroll)
│   └── if isExtending: elementFromPoint → closest('[data-word-id]') → onSetSelection(rangeBetween(…))
└── pointerup / pointercancel
    └── clear timer, setIsExtending(false), clear anchor

Words container className includes [-webkit-touch-callout:none] always,
plus touch-none only when isExtending (so panel scroll keeps working
outside the gesture).
```

## Output format

### `src/frontend/apps/doc-viewer/OcrTextView.tsx`

Apply six edits. They are all local to this file; no other file changes.

#### 1. Add new refs and state at the top of the component (next to the existing `dragAnchorRef`)

```ts
const [isExtending, setIsExtending] = useState(false)
const longPressTimerRef = useRef<number | null>(null)
const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
const lastExtendIdRef = useRef<string | null>(null) // de-dupe extend updates
```

#### 2. Add `data-word-id={word.id}` to each rendered word span

Currently:
```tsx
<span
  key={word.id}
  ref={isLastSelected ? lastSelectedRef : null}
>
  <span
    onPointerDown={(e) => handleWordPointerDown(word, e)}
    onPointerEnter={() => handleWordPointerEnter(word)}
    …
  >
```

The outer `<span>` should become the one with `data-word-id`:
```tsx
<span
  key={word.id}
  data-word-id={word.id}
  ref={isLastSelected ? lastSelectedRef : null}
>
```

This way `document.elementFromPoint(x, y).closest('[data-word-id]')` finds the wrapping span regardless of which inner element the finger is over (text node, etc.).

#### 3. Replace the existing window-listener `useEffect` (currently handling only `pointerup`/`pointercancel`) with a combined one

Replace the current block:
```ts
useEffect(() => {
  function onUp() {
    dragAnchorRef.current = null
    dragBaseSelectionRef.current = []
  }
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  return () => {
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
}, [])
```

With:
```ts
useEffect(() => {
  function onMove(e: PointerEvent) {
    // 1) Cancel a pending long-press if the finger moved past tolerance.
    if (longPressTimerRef.current !== null && longPressStartRef.current) {
      const dx = e.clientX - longPressStartRef.current.x
      const dy = e.clientY - longPressStartRef.current.y
      if (dx * dx + dy * dy > 64) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
        longPressStartRef.current = null
      }
    }
    // 2) While extending, extend the range to whichever word is under the finger.
    if (isExtending && dragAnchorRef.current) {
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const wordEl = target?.closest('[data-word-id]') as HTMLElement | null
      const id = wordEl?.dataset.wordId
      if (id && id !== lastExtendIdRef.current) {
        lastExtendIdRef.current = id
        onSetSelection(
          rangeBetween(wordOrder, dragAnchorRef.current, id, allWordsOrdered),
        )
      }
    }
  }
  function onEnd() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
    lastExtendIdRef.current = null
    if (isExtending) setIsExtending(false)
    dragAnchorRef.current = null
    dragBaseSelectionRef.current = []
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
  window.addEventListener('pointercancel', onEnd)
  return () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
  }
}, [isExtending, allWordsOrdered, onSetSelection, wordOrder])
```

The effect re-attaches on `isExtending` changes so the closure captures the current value.

#### 4. In `handleWordPointerDown`, add the touch branch at the end

After the existing shift / meta / ctrl branches and after `onSetSelection([word.id])`, append:

```ts
// Touch / pen: start a long-press timer. If the finger stays still for
// 300ms, enter extend mode; subsequent finger movement will extend the
// range via the window pointermove listener.
if (e.pointerType !== 'mouse') {
  longPressStartRef.current = { x: e.clientX, y: e.clientY }
  longPressTimerRef.current = window.setTimeout(() => {
    longPressTimerRef.current = null
    setIsExtending(true)
    navigator.vibrate?.(10) // haptic confirmation (Android only; iOS Safari ignores)
  }, 300)
}
```

The branches that early-`return` (shift, meta/ctrl) should NOT start the timer — only the plain-press path does. Place the new block accordingly (right after `onSetSelection([word.id])`).

Update the `useCallback` dependency array to add `setIsExtending` (or omit since setState setters are stable; React 18 lints either way — match the project's existing style).

#### 5. Apply the CSS guards on the OCR pages container

Find the outer scroll container (currently `<div className="flex-1 overflow-y-auto p-3 space-y-3">` — the one wrapping `visiblePages.map(...)`) and change to:

```tsx
<div
  className={`flex-1 overflow-y-auto p-3 space-y-3 select-none [-webkit-touch-callout:none] ${
    isExtending ? 'touch-none' : ''
  }`}
>
```

- `select-none` — suppress native text selection on tap (was implicit through the inner `<p>`s; now explicit at the container level)
- `[-webkit-touch-callout:none]` — always on: suppresses iOS's copy/share popup that would otherwise fire on long-press before our 300ms timer
- `touch-none` (`touch-action: none`) — toggled on during extend so the browser doesn't interpret finger drag as a panel scroll mid-gesture; toggled off so vertical scroll keeps working normally

#### 6. Update the no-selection tip line for mobile

Replace the existing mobile tip:
```tsx
<span className="sm:hidden">Tip: tap a word to select.</span>
```

With:
```tsx
<span className="sm:hidden">Tip: tap a word; long-press to start a range.</span>
```

The desktop tip is unchanged.

## Acceptance criteria

- [ ] On iPhone Safari (installed PWA): tap a word → single-select (unchanged)
- [ ] Press and hold a word for ~300 ms without moving → that word becomes the anchor; subtle haptic on Android, none on iOS
- [ ] While still pressing, dragging the finger across other words extends the selection live; the range follows the finger across line wraps and across pages
- [ ] Lifting the finger commits the range; the existing SelectionControls (color swatches + note) act on the full multi-word selection
- [ ] Tapping briefly (releasing before 300 ms) is still a single-tap select — no accidental ranges
- [ ] Moving the finger more than ~8 px in the first 300 ms cancels the long-press timer and the panel scrolls normally — no accidental range from a scroll attempt
- [ ] The iOS callout (copy / share popup) does NOT appear when long-pressing a word
- [ ] Outside the gesture, scrolling the OCR panel still works normally
- [ ] Desktop behavior unchanged: click = single-select; mouse drag-extend = range; shift+click = range to anchor; ⌘/Ctrl+click = toggle word
- [ ] Build passes (`tsc && vite build`)

## Constraints

- **Single file.** All edits in `apps/doc-viewer/OcrTextView.tsx`. No other files.
- **No new dependencies.**
- **No `any`.** `longPressTimerRef.current` is `number | null` (`window.setTimeout` returns a number in browsers). The `wordEl?.dataset.wordId` access is typed as `string | undefined`.
- **Branch on `pointerType !== 'mouse'`**, not `=== 'touch'` — pen reports `'pen'` and Mac trackpad gestures occasionally report it too. Treating both pen and touch like touch is correct.
- **Clear the long-press timer on every exit path** — pointerup, pointercancel, movement > tolerance. Otherwise the timer fires after the gesture and surprises the user.
- **De-dupe extend updates** via `lastExtendIdRef` so we don't call `onSetSelection` on every pixel of finger movement (only when the under-finger word actually changes).
- **Don't change desktop event flow.** The `onPointerEnter` handler stays; only `pointerType !== 'mouse'` triggers the new path in pointerdown.

## Test plan

1. `npm run build` — TypeScript + Vite must pass
2. `npm run dev` and exercise on desktop Chrome:
   - Tap → single-select
   - Mouse drag across words → extends (existing behavior intact)
   - Shift+click and ⌘/Ctrl+click → as today
3. Chrome DevTools mobile emulation (iPhone preset):
   - Toggle touch simulation; verify tap, long-press, and long-press-then-drag work
4. Real iPhone (installed PWA from PR #22):
   - Upload a PDF, run OCR
   - Quick tap a word — selects one
   - Long-press a word for ~1 second without moving — confirm SelectionControls show only that word (anchor set)
   - Continuing to press, drag across 4–5 more words — selection extends live
   - Lift — color swatches now apply to the multi-word range
   - Try to scroll the panel by quick swipe — should scroll, not select
   - Verify the iOS copy/share popup doesn't appear during long-press
