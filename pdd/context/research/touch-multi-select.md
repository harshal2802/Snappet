# Research: Touch multi-word selection in OcrTextView

**Date**: 2026-05-27
**Source**: User reports it's hard to select multiple OCR'd words on iPhone (the v1 punt from PR #23 was real, not theoretical)
**Outcome**: Build — long-press-then-drag (iOS-native pattern). Single tap stays single-select; long-press anywhere on a word enters extend mode; finger drag across words extends; lift commits.

## Problem

Users reading an OCR'd document on iPhone can highlight a single word in one tap, but the only ways to select multiple words today are shift+click and ⌘/Ctrl+click — both impossible on a touch device. The Annotations feature is therefore only usable for single-word highlights on mobile.

## Constraints

- **No new dependencies** — fix has to live inside OcrTextView.tsx
- **Don't break desktop** — mouse drag-extend, shift+click, ⌘/Ctrl+click must continue to work
- **Don't break scrolling** — short tap = single-select, short drag = page scroll. Hijacking *every* touch-drag for selection is unacceptable (users couldn't scroll the panel)
- **No exotic gestures** — should feel native to anyone who's used iOS text selection
- **Self-contained UI** — no toggle button or mode indicator chrome that clutters the existing SelectionControls

## Options evaluated

### Option 1 — Long-press → drag (Build) **— recommended**

**What**: Pressing and holding a word for ~300 ms enters "extend mode": anchor = that word, single-word selection set. While still pressing, dragging the finger across words extends the range (via window `pointermove` + `document.elementFromPoint`). Lifting the finger commits the range. Short tap (release before timer fires) is still a single-tap select. Short drag (movement before timer fires) cancels the timer and the browser scrolls normally.

**Pros**:
- Mirrors iOS native text selection — virtually no learning curve
- Cleanly separates intent: tap = select one, scroll = scroll, long-press-then-drag = multi-select
- Reuses the existing `dragAnchorRef` + `rangeBetween` selection machinery — only the *entry* gesture is new
- ~50–80 LoC localized to OcrTextView.tsx

**Cons**:
- Discoverability: an unprompted user might not know to long-press. Mitigate with the existing breakpoint-conditional tip line ("Tip: long-press a word to start a range").
- Needs `-webkit-touch-callout: none` and `user-select: none` on the words container to suppress iOS's own copy/share popup on long-press.
- Needs `touch-action: none` *only while in extend mode* so the browser doesn't steal `pointermove` for scrolling once extending starts.

**Effort**: Medium

### Option 2 — Tap-anchor → "Extend to..." button → tap end (Build)

**What**: After a single-word tap, show an "Extend to next tap" button in SelectionControls. Tapping it arms a mode; the next tap on any word completes the range from anchor to that word.

**Pros**: Explicit, no gestures to learn. Easy to implement (~30 LoC).

**Cons**: Two extra taps for every multi-word selection (button + end word). Mode-toggle UI feels clunky next to color swatches. Doesn't match iOS conventions, so the desktop and mobile experiences diverge mentally.

**Effort**: Low

### Option 3 — Persistent "extend mode" toggle in SelectionControls (Build)

**What**: A toggle pill next to the color swatches: "Extend (off/on)". When on, every tap extends the current selection from its current anchor.

**Pros**: Powerful for users who want many words.

**Cons**: Modal — easy to forget the mode is on and accidentally extend instead of single-select. UI clutter. Solves the same problem worse than Option 2.

**Effort**: Low–Medium

### Option 4 — iOS-style drag handles (Build)

**What**: After a single-word select, render two draggable circular handles at the start and end of the selected span. Drag handles to extend/contract.

**Pros**: Most native-feeling, matches Apple's text selection model exactly.

**Cons**: A lot of code — handles must be absolutely positioned at the visual edges of word spans, account for line wraps, follow scrolling, hide during PDF jump. Probably 200+ LoC and brittle to text reflow.

**Effort**: High

### Option 5 — Pure drag-from-word with `elementFromPoint` (Build)

**What**: Any pointer-drag that begins on a word extends the selection live (via the same elementFromPoint trick). Drag starting in a gap scrolls normally.

**Pros**: Closest UX parity with desktop (just drag).

**Cons**: **Breaks panel scrolling on a phone.** Users naturally start vertical scroll gestures by touching any visible content. Every accidental swipe across the OCR panel would extend selection. Tested mentally and ruled out.

**Effort**: Medium

## Recommendation

**Option 1 — long-press → drag.** Picks up the iOS gesture vocabulary users already know, doesn't conflict with scrolling, and the implementation reuses the selection machinery we already have. The only new mechanics are (a) the long-press timer, (b) `document.elementFromPoint` lookups during drag, and (c) the touch-action/callout/user-select CSS guards.

### Implementation outline

- Bind `onPointerDown` on each word as today, with one new branch when `pointerType !== 'mouse'`:
  - Schedule a `setTimeout(() => enterExtendMode(word), 300)`
  - If `pointermove` exceeds ~8 px tolerance before timer fires → `clearTimeout` (it's a scroll)
  - If `pointerup` fires before timer → `clearTimeout`, leave single-select intact
- `enterExtendMode(word)`:
  - Set `dragAnchorRef.current = word.id` (reuses existing ref)
  - Apply class to the words container that sets `touch-action: none; -webkit-touch-callout: none`
  - Optional UX nicety: `navigator.vibrate?.(10)` for haptic confirmation on Android (Safari ignores)
- Window `pointermove` while in extend mode:
  - `document.elementFromPoint(e.clientX, e.clientY)`
  - `.closest('[data-word-id]')` to find the word
  - If found and id ≠ last extended id → `onSetSelection(rangeBetween(...))`
- Window `pointerup` / `pointercancel`: clear the extend-mode class; anchor stays for the SelectionControls
- New attribute `data-word-id={word.id}` on each word span (doesn't exist today; small change)
- Update the mobile tip line: "Tap a word to select; long-press to start a range."

Desktop behavior is unchanged: the new branch only fires for touch/pen pointers.

## Rejected alternatives (logged)

- **Option 2 (tap-anchor + button)**: Mode-toggle UI clutter; two extra taps per selection.
- **Option 3 (persistent toggle)**: Same drawbacks plus mode-confusion.
- **Option 4 (iOS handles)**: Too much code for a feature that affects a single mini-app.
- **Option 5 (pure drag)**: Steals scrolling.

## Next step

`/project:pdd-plan` then `/project:pdd-prompts` to draft `19-touch-multi-select.md`.
