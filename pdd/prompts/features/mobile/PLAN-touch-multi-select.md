# Implementation Plan: Touch multi-word selection (long-press → drag)

**Created**: 2026-05-27
**Complexity**: Medium
**Estimated prompts**: 1

## Summary

Mirror iOS native text selection in OcrTextView. Pressing and holding a word for 300 ms enters extend mode (anchor = that word); finger drag across other words extends the range via `document.elementFromPoint`; lifting commits. Short tap stays single-select; movement before the timer fires cancels and lets the browser scroll normally. Reuses the existing `dragAnchorRef` + `rangeBetween` machinery — only the entry gesture is new.

Research: `pdd/context/research/touch-multi-select.md`
Decision: `pdd/context/decisions.md` (2026-05-27 entry)

## Phases

### Phase 1 — Implement long-press-then-drag in OcrTextView

**Produces**:
- `apps/doc-viewer/OcrTextView.tsx` — new touch branch in `handleWordPointerDown`; long-press timer + tolerance cancel; window `pointermove` listener using `document.elementFromPoint` + `.closest('[data-word-id]')`; CSS guards (`touch-action: none`, `-webkit-touch-callout: none`, `user-select: none`) toggled by an `isExtending` state during the gesture only
- A new `data-word-id={word.id}` attribute on the word span (doesn't exist today; needed for elementFromPoint lookups)
- Updated mobile tip line in the no-selection help text: "Tap a word to select; long-press to start a range."
- Optional `navigator.vibrate?.(10)` haptic when entering extend mode (Android only — iOS Safari ignores; safe call)

**Depends on**: existing OcrTextView selection code (PR #23 pointer-event refactor).

**Risk**: Medium.
- Touch-action / scroll conflict: applying `touch-action: none` globally during extend would break the panel's vertical scroll *after* the gesture; toggle by `isExtending` so it's scoped in time.
- iOS Safari's "callout" (copy/share popup) fires on long-press by default; suppress with `-webkit-touch-callout: none` *and* `user-select: none` on the words container.
- The Mac trackpad reports `pointerType === 'pen'` for some gestures — branch on `pointerType !== 'mouse'` rather than `=== 'touch'` so pen behaves like touch (also iOS-friendly).
- `clearTimeout` discipline: must clear the long-press timer on pointerup, pointercancel, *and* on movement beyond the tolerance, otherwise the timer fires after a scroll and surprises the user.

**Prompt**: `pdd/prompts/features/mobile/19-touch-multi-select.md`

## Risks & Unknowns

All settled in research. The only thing not exercisable in CI is the actual on-device feel — must be verified on a real iPhone after deploy.

## Decisions Needed

None new — research decided gesture, threshold (300 ms), tolerance (8 px), and the CSS guard scope.

## Why one phase

Same reasoning as PR #23's plan: a single user-visible behavior, one file change, no testable sub-artifact in between. Splitting into "add data-word-id" / "add timer" / "add elementFromPoint loop" / "add CSS guards" would just multiply round-trips.

## Next step

`/project:pdd-prompts` to draft `19-touch-multi-select.md`.
