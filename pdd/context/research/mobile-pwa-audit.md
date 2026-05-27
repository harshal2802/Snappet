# Research: Mobile / iPhone-PWA usability audit of all Snappet apps

**Date**: 2026-05-27
**Trigger**: Snappet just shipped PWA support (PR #22). User wants the apps to actually work when installed on an iPhone in standalone mode.
**Outcome**: One bundled mobile-fixes PR covering 6 concrete issues across 4 apps. Most apps are already fine on touch.

## Method

Audit script: walk every app in `src/frontend/apps/` plus `components/Layout.tsx`. Per app, check the 12-item mobile/touch checklist (see Audit Checklist below). Verify cited line numbers in code before treating findings as actionable.

### Audit checklist

1. Touch event support — `onMouseDown` / `onMouseEnter` / `onMouseLeave` don't fire on touch
2. Hover-only affordances — `opacity-0 group-hover:opacity-100`, `hidden group-hover:block`
3. Layout at 375 px — sidebars wider than the viewport, side-by-side flex without column fallback
4. dnd-kit on touch — activation threshold appropriate for finger drag vs intentional tap
5. Tap target size < 40 × 40 px
6. Missing `inputmode` / `type` hints for numeric inputs
7. Resizers / splitters that need pointer drag
8. Safe-area / notch / soft-keyboard handling on `position: fixed` overlays
9. iOS file input + drag-drop fallback
10. html-to-image / Canvas on iOS Safari
11. Notification API on iOS PWA (16.4+ standalone-only)
12. Horizontal scroll on narrow screens

## Findings

### Blocking (feature unusable on iPhone)

**B1. `apps/doc-viewer/index.tsx` — split-pane layout fixed at 320 px sidebar + flex-1 viewer + mouse-only resizer.** On a 375 px viewport the viewer gets ~50 px of usable width and the resizer can't be dragged on touch. The whole app is unusable on a phone.
- Fix: switch to **single-column at `md`-and-below**. Below `md`, stack viewer on top and panel below with the panel collapsible. The resizer is desktop-only.

**B2. `apps/doc-viewer/OcrTextView.tsx` — drag-selection uses `onMouseDown` + `onMouseEnter`.** Those events don't fire from touch. The whole multi-word selection + annotate flow is broken on iPhone.
- Fix: switch to `onPointerDown` / `onPointerEnter` (the unified pointer events handle mouse, touch, and pen). Add `touch-action: none` to the words container so iOS doesn't steal touchmove for scrolling. Also handle the case where the user lifts their finger off-screen (`pointercancel`).

### Should-fix (degraded UX, feature works but is hard to discover/use)

**S1. `apps/json-explorer/JsonTree.tsx` line 109 — "copy" button is `opacity-0 group-hover:opacity-100`.** Invisible on touch; users have no way to copy a JSON path on iPhone.
- Fix: always-visible on touch, hover-only on desktop. Tailwind: `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`.

**S2. `apps/code-snapshot/index.tsx` line 364 — theme color swatch labels are `opacity-0 group-hover:opacity-100`.** Touch users see unlabeled swatches.
- Same fix as S1: make labels visible on touch (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`), or move the label below the swatch on mobile.

**S3. `apps/kanban-board/index.tsx` line 41 — `PointerSensor` activation distance `5`.** On touch, scrolling a column will trigger a drag because finger movements are noisier than mouse. Card opens-on-tap conflict with drag-start.
- Fix: bump to `distance: 8` for touch via `activationConstraint` (or use the dnd-kit recommended pattern of `delay: 200, tolerance: 5` for touch). Distance-only is fine for mouse.

**S4. `apps/code-snapshot/index.tsx` lines 134–166 — `html-to-image`'s `toPng` / `toBlob` is flaky on iOS Safari** (known WebKit issue with `<foreignObject>` rasterization and oversized canvases). Currently logs to console — no user feedback when it fails.
- Fix: surface a visible error message on failure ("Export failed — try a smaller preview, or copy code to clipboard"). Don't try to detect Safari; just handle the rejection.

### Consider (nits)

**C1. `apps/pomodoro-timer/index.tsx` — `Notification.requestPermission()` will silently fail on iOS Safari unless the user added the app to their home screen on iOS 16.4+.** The existing fallback banner is good — but on iOS in-browser, the user sees nothing for a while, wonders why no notifications.
- Fix: add a one-line hint near the permission prompt: "On iPhone, install Snappet to home screen for notifications."

### Clean apps (no findings)

- `hub`, `example`, `tip-calculator`, `expense-splitter`, `regex-playground`, `markdown-editor`, `age-calculator`, `color-picker`, `password-generator`, `components/Layout.tsx`

## Decision

**Bundle into one PR.** Each fix is small (<30 lines), they share the "mobile" review concern, and splitting into 6 PRs would multiply the review-and-merge overhead without isolating risk.

**Phase split (in the plan):** One phase, one prompt — `18-mobile-touch-fixes.md`. Implement all 6 items together; PR description groups them by app for review.

## Rejected alternatives

- **Per-app PRs**: rejected for the reason above.
- **A mobile-detection layer / different mobile component tree**: over-engineered. The actual fixes are 90% Tailwind responsive variants + swapping mouse events for pointer events.
- **Custom-build a touch DnD library**: not needed — dnd-kit already supports touch via PointerSensor; we just have the wrong activation threshold.

## Next step

`/project:pdd-plan` then `/project:pdd-prompts` to draft `18-mobile-touch-fixes.md`.
