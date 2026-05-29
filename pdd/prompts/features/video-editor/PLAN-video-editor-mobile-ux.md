# Implementation Plan: Video Editor — mobile UX

**Created**: 2026-05-29
**Builds on**: pro upgrade (#51). Research: `pdd/context/research/video-editor-mobile-ux.md`.

## Goal
Make the editor phone-first without regressing desktop. One feature branch, build-green
per commit, deployed via PR → main → Pages.

## Phases
- **M1 — Responsive layout + bottom sheets**: `support/useMediaQuery.ts` (`useIsMobile`),
  reusable `ui/BottomSheet.tsx`, restructure `index.tsx` into a mobile single-column
  (compact top bar → capped preview → scrollable toolbar → timeline → bottom action bar)
  vs desktop 3-col. MediaBin/Dropzone and Inspector become bottom sheets on mobile;
  Properties auto-opens on selection. Viewport `viewport-fit=cover`, safe-area padding,
  `100dvh`, global `touch-action: manipulation` + `overscroll-behavior`.
- **M2 — Touch targets + timeline gestures**: ≥44px hit areas (player/toolbar/handles/
  playhead); `touch-action` discipline on timeline (pan-x scroller, none on clips/handles);
  movement threshold in `useTimelineDrag` (tap-vs-drag); pinch-to-zoom; `user-select:none`.
- **M3 — Dialogs + polish**: ExportDialog as bottom sheet on mobile; styled reset confirm
  (replace `window.confirm`); typography bumps; `prefers-reduced-motion`.

## Risks
- Conditional mobile/desktop rendering must not break the WebGL canvas/renderer lifecycle
  (Player mounts once per layout). Use a media-query hook and a single Player instance per
  layout branch — accept canvas remount on breakpoint change (rare).
- Pinch handler must not interfere with single-pointer drag (track pointer count).

## Status
- M1–M3 — in progress (this chain).
