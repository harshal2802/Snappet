# Implementation Plan: Mobile / touch / PWA fixes

**Created**: 2026-05-27
**Complexity**: Low–Medium
**Estimated prompts**: 1

## Summary

Apply 6 targeted fixes from `pdd/context/research/mobile-pwa-audit.md` so installed-PWA users on iPhone get a working experience. Most fixes are Tailwind responsive variants or swapping mouse events for unified pointer events. The Document Viewer layout change is the only meaningful refactor — it goes single-column below `md`.

Research: `pdd/context/research/mobile-pwa-audit.md`

## Phases

### Phase 1 — Apply all mobile fixes

**Produces**:
- `apps/doc-viewer/index.tsx` — single-column layout below `md` (panel stacks below viewer, collapsible); resizer hidden on mobile
- `apps/doc-viewer/OcrTextView.tsx` — `onMouseDown`/`onMouseEnter` → `onPointerDown`/`onPointerEnter`; add `touch-action: none` on the words container; handle `pointercancel`
- `apps/json-explorer/JsonTree.tsx` — hover-only copy button visible on touch (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`)
- `apps/code-snapshot/index.tsx` — same hover-fix on swatch labels; surface a visible error when `html-to-image` rejects
- `apps/kanban-board/index.tsx` — `PointerSensor` activation tuned for touch (use the dnd-kit-recommended `delay: 200, tolerance: 5` for touch via `TouchSensor` alongside `PointerSensor`, OR bump `distance` to `8`)
- `apps/pomodoro-timer/index.tsx` — one-line iOS install hint near the permission banner

**Depends on**: nothing (all changes are additive or local)

**Risk**: Medium for the doc-viewer layout change (must not break desktop); Low for the rest (small, isolated edits).

**Prompt**: `pdd/prompts/features/mobile/18-mobile-touch-fixes.md`

## Risks & Unknowns

- **Doc-viewer single-column layout** — needs to not regress the desktop two-pane experience. Test plan must cover both viewports. The panel's `style={{ width: panelWidth }}` from the splitter must not apply at mobile widths; either gate it on a media-query state or wrap in a `hidden md:flex` container.
- **OcrTextView `touch-action: none`** — required so iOS doesn't hijack `pointermove` for page scrolling, but we must apply it only to the words container, not the whole panel — the rest of the panel needs to scroll normally.
- **Kanban touch DnD** — dnd-kit's recommended pattern is a separate `TouchSensor` with `delay: 200, tolerance: 5` *plus* the `PointerSensor` for mouse. Choosing between that and bumping pointer distance is a trade-off (delay = clearer intent, distance = quicker). Default to TouchSensor + PointerSensor pattern; it's what dnd-kit documents.
- **iOS PWA notification hint in Pomodoro** — pure UX line; only shows when the permission state is `default`.

## Decisions Needed

None pending — the research already settled (a) one-PR vs many, (b) responsive layout vs separate mobile component tree, (c) dnd-kit's recommended touch pattern.

## Why one phase / one prompt

Already justified in research:
- Each fix is < 30 LoC
- They share a single review concern ("does it work on iPhone?")
- 6 PRs would multiply review overhead with no risk-isolation benefit

The single prompt will group the changes by app so review can read app-by-app.

## Next step

`/project:pdd-prompts` to draft `18-mobile-touch-fixes.md`.
