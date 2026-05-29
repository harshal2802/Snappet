# Research: Video editor — mobile UX audit & plan

**Date**: 2026-05-29
**Lens**: senior mobile UX engineer. Target: phones in portrait, ~360–430px, touch.
**Method**: web research on CapCut/InShot/Edits mobile patterns + WCAG/Material/HIG target
sizing + audit of the current desktop-first implementation.

## Current problems (audit)
- **Desktop-first layout**: `grid md:grid-cols-[260px_1fr_240px]` collapses to a single
  column where the **MediaBin + Dropzone sit ABOVE the preview**, pushing the player and
  timeline far down. Wrong priority order for phones.
- **Tiny touch targets**: timeline trim handles are `w-2` (8px), playhead grab is tiny,
  most icon buttons are `p-1`/`text-xs` (<44px). WCAG 2.5.5/HIG want ≥44px; Material 48dp.
- **No touch gestures on timeline**: zoom is mouse `ctrl+wheel` only; no pinch-to-zoom; no
  `touch-action`, so clip-drag fights native scroll and the page rubber-bands while scrubbing.
- **`window.confirm`** for Reset (ugly/blocking on mobile, unstyleable).
- **ExportDialog** is a small centered box — cramped on a 360px screen.
- **No safe-area handling**; viewport lacks `viewport-fit=cover`; uses `vh` not `dvh`.
- Tiny fonts (`text-[9px]`/`[10px]`) throughout.

## Decisions (what we'll build)
1. **Preview-first single-column layout below `md`**: compact top bar → **preview (capped
   height)** → contextual toolbar (horizontally scrollable) → timeline → bottom action bar.
   Keep the desktop 3-column grid at `md+`.
2. **Media library & clip Properties as bottom sheets** (thumb-reachable), opened from a
   bottom action bar; preview/timeline stay visible. Reusable `BottomSheet` (drag handle +
   visible ✕, safe-area padding, `dvh`, `prefers-reduced-motion` aware, backdrop, Esc/scrim
   dismiss). Auto-open Properties when a clip/text is selected on mobile.
3. **Touch targets ≥44px** on player controls, toolbar buttons, timeline handles & playhead
   (slim visual bar + wide invisible grab zone). `touch-action: manipulation` on controls.
4. **Timeline touch**: `touch-action: pan-x` + `overscroll-behavior-x: contain` on the
   scroller; clips/handles `touch-action: none` so a drag on a clip moves it while a drag on
   empty space scrolls; **movement threshold** so a tap selects (no accidental nudge);
   **pinch-to-zoom** (two-pointer) anchored at the pinch midpoint.
5. **Dialogs**: ExportDialog → bottom sheet full-width on mobile (centered on desktop);
   replace `window.confirm` with a styled confirm sheet.
6. **Viewport/safe-areas/typography**: `viewport-fit=cover`; `env(safe-area-inset-*)` padding
   on top/bottom bars & sheets; `100dvh`; bump the smallest fonts; `user-select:none` +
   `-webkit-touch-callout:none` on draggable clips; `overscroll-behavior` to stop pull-to-refresh.

## Reference numbers
- Touch target: Apple 44×44pt, Material 48dp + 8dp gap, WCAG AAA 44px (AA floor 24px).
- Long-press 300–500ms; haptic pulses 10–20ms (`navigator.vibrate`, Android/Chrome).
- Bottom-sheet detents: peek/medium ≈ 50%, large ≈ full.

Sources captured in the research pass: NN/g bottom sheets; W3C WCAG 2.5.5/2.5.8; MDN
`touch-action`/Pointer pinch/`prefers-reduced-motion`; Apple HIG Sheets; Material 3 bottom
sheets; CapCut/InShot/Edits interface docs; safe-area-inset guides.
