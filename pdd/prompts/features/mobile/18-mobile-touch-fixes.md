# Prompt: Mobile / touch / PWA fixes

**File**: pdd/prompts/features/mobile/18-mobile-touch-fixes.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: `pdd/context/research/mobile-pwa-audit.md`
**Plan**: `pdd/prompts/features/mobile/PLAN-mobile-touch-fixes.md`
**Depends on**: the existing implementations of doc-viewer, json-explorer, code-snapshot, kanban-board, pomodoro-timer

## Context

Snappet ships as a PWA (PR #22). The user installed it on an iPhone and several apps don't work or are awkward in mobile Safari / standalone mode. This prompt applies 6 targeted fixes — most are Tailwind responsive variants or swapping mouse events for unified pointer events. One real refactor: Document Viewer's split-pane goes single-column below the `md` breakpoint.

**Stack**: React 18, TypeScript (strict), Tailwind CSS, Vite. No new dependencies.

## Task

Apply all six fixes below. Group them in the diff by app for review. Do NOT change unrelated behavior in any app.

## Output format

### A. `apps/doc-viewer/index.tsx` — responsive split-pane

Currently the loaded-file layout is hard-wired to:
```
<div className="flex flex-1 overflow-hidden">
  <div ref={...} className="flex-1 relative overflow-hidden">{viewer + HighlightOverlay}</div>
  <div onMouseDown={...} className="w-1 cursor-col-resize ..." />              ← resizer
  <div className="shrink-0 overflow-hidden flex flex-col" style={{ width: panelWidth }}>{TextPanel}</div>
</div>
```

On a 375 px viewport that leaves ~50 px for the viewer. Change it to:

1. **Layout** — wrap with `flex-col md:flex-row`. The viewer pane is `h-1/2 md:h-auto md:flex-1` and the panel container is `w-full h-1/2 md:h-auto md:shrink-0`. On mobile the two stack 50/50; on desktop they live side-by-side with the resizer.
2. **Resizer** — wrap with `hidden md:block` so the 1-px grabber is only present on desktop. Same for the full-screen drag-capture overlay.
3. **Persisted panel width applies only on desktop** — the panel container's inline `style={{ width: panelWidth }}` must not apply at mobile widths (it would override `w-full`). Detect breakpoint via a small inline `useMediaQuery('(min-width: 768px)')` hook (or use `matchMedia` directly inside a `useState` + `useEffect`), and only set the `style` when `isDesktop` is true.

Concrete pattern for the breakpoint hook (put inline at the top of the file, just below the `LegacyAnnotation` migration helper):
```ts
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}
```

Then in the component:
```ts
const isDesktop = useMediaQuery('(min-width: 768px)')
```

And on the panel container:
```tsx
<div
  className="w-full h-1/2 md:h-auto md:shrink-0 overflow-hidden flex flex-col border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700"
  style={isDesktop ? { width: panelWidth } : undefined}
>
```

Note the `border-t md:border-t-0 md:border-l` — on mobile a thin top border separates panel from viewer; on desktop the panel gets its existing left border (this is already in TextPanel.tsx as `border-l`, so apply only the additive top border at the container level).

### B. `apps/doc-viewer/OcrTextView.tsx` — pointer events for touch-friendly selection

Current behavior uses `onMouseDown` + `onMouseEnter` on each word span. These don't fire on touch — selecting any word on iPhone is impossible. Change to pointer events:

1. **Rename handlers**: `handleWordMouseDown` → `handleWordPointerDown`, `handleWordMouseEnter` → `handleWordPointerEnter`. Wire them via `onPointerDown` / `onPointerEnter`.
2. **Window listener**: replace the `window.addEventListener('mouseup', …)` with both `pointerup` *and* `pointercancel` (iOS sends `pointercancel` if the OS interrupts — e.g. notification).
3. **Touch users get single-tap selection only.** Drag-extend across words relies on `pointerenter` firing as the cursor crosses elements — which only happens for mouse pointers (touch uses implicit pointer capture). This is deliberate — multi-select is a desktop feature. Mouse drag-extend, shift+click, and ⌘/Ctrl+click continue to work on desktop. Update the in-app tip line to reflect this:

```tsx
{selectedWords.length === 0 && (
  <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 shrink-0">
    <span className="hidden md:inline">Tip: drag across words, or shift+click for a range, or ⌘/Ctrl+click to toggle.</span>
    <span className="md:hidden">Tip: tap a word to select.</span>
  </div>
)}
```

4. **Don't change `e.preventDefault()` in the pointerdown handler** — it's still needed to suppress native text selection on mouse; on touch it's a no-op for the click flow.

### C. `apps/json-explorer/JsonTree.tsx` — copy button visible on touch

Line 109 currently:
```tsx
className="ml-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded shrink-0"
```

Change `opacity-0` to `opacity-100 sm:opacity-0` and the `group-hover` rule to `sm:group-hover:opacity-100`:
```tsx
className="ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded shrink-0"
```

Result: on touch (no `sm:hover` ever evaluating) the button is always visible; on desktop it stays hidden until row hover.

### D. `apps/code-snapshot/index.tsx` — swatch labels visible on touch + visible export errors

**D1. Swatch labels** — line 364 currently:
```tsx
className="absolute inset-0 flex items-center justify-center text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
```

Same Tailwind fix:
```tsx
className="absolute inset-0 flex items-center justify-center text-[10px] font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
```

**D2. `html-to-image` failure surfaces** — currently both `handleDownload` and `handleCopy` only `console.error` on rejection. iOS Safari rejects regularly. Add a small `exportError: string | null` state, set it on catch, render it as a dismissable banner above the preview controls:

```ts
const [exportError, setExportError] = useState<string | null>(null)
```

In each catch:
```ts
} catch (err) {
  console.error('Failed to export image:', err)
  setExportError(
    err instanceof Error
      ? `Export failed: ${err.message}. iOS Safari sometimes can't rasterize the preview — try a smaller code sample.`
      : 'Export failed.',
  )
}
```

Render near the action buttons (above the preview):
```tsx
{exportError && (
  <div className="mb-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
    <span className="flex-1">{exportError}</span>
    <button
      onClick={() => setExportError(null)}
      aria-label="Dismiss"
      className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300"
    >
      ✕
    </button>
  </div>
)}
```

Clear `exportError` to `null` at the start of each new export attempt.

### E. `apps/kanban-board/index.tsx` — split into MouseSensor + TouchSensor

Currently:
```ts
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  })
)
```

PointerSensor handles both mouse and touch with one threshold — a `distance: 5` is too tight on touch (a fingertip's natural micro-movement triggers an accidental drag while scrolling). Use dnd-kit's recommended pattern:

```ts
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensors,
  useSensor,
} from '@dnd-kit/core'
```

```ts
const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  }),
  useSensor(TouchSensor, {
    // Long-press 200ms with 5px tolerance — clearly separates "tap to open"
    // from "drag to reorder" on touch.
    activationConstraint: { delay: 200, tolerance: 5 },
  }),
)
```

Net change: the `PointerSensor` import becomes `MouseSensor`, a second `TouchSensor` is added. Everything else is unchanged.

### F. `apps/pomodoro-timer/index.tsx` — iOS PWA notification hint

The existing "Allow notifications…" hint only shows when `Notification.permission === 'default'`. iOS Safari in the regular browser silently denies — users wonder why the dialog never appears. Add a tiny line beneath the existing hint to explain when iOS needs the install-to-home-screen step:

Find the existing block:
```tsx
{typeof Notification !== 'undefined' && notifPermission === 'default' && (
  <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
    Allow notifications to be alerted when a phase ends.
  </p>
)}
```

Replace with:
```tsx
{typeof Notification !== 'undefined' && notifPermission === 'default' && (
  <div className="text-xs text-gray-400 dark:text-gray-500 text-center space-y-1">
    <p>Allow notifications to be alerted when a phase ends.</p>
    <p className="text-[10px]">On iPhone, install Snappet to your home screen first — Safari's tab can't request notifications.</p>
  </div>
)}
```

## Acceptance criteria

- [ ] Doc Viewer at 375 px width: viewer and panel stack vertically, each ~50% height; no horizontal scroll; the desktop resizer is not visible
- [ ] Doc Viewer at ≥ 768 px width: identical to today's layout (split-pane, resizer present, persisted `panelWidth` applies)
- [ ] OcrTextView on iPhone: tapping any extracted word selects it (single); the SelectionControls panel slides in; color swatches apply highlight
- [ ] OcrTextView on desktop: drag-select, shift+click, ⌘/Ctrl+click all still work
- [ ] JSON Explorer tree on iPhone: per-row "copy" button is visible by default
- [ ] JSON Explorer tree on desktop: copy button stays hidden until the row is hovered
- [ ] Code Snapshot theme swatches on iPhone: label visible by default; on desktop hidden until hover
- [ ] Code Snapshot export on iOS: if `toPng` / `toBlob` rejects, a dismissable red banner appears with the error and a hint; banner clears on retry
- [ ] Kanban Board on iPhone: tapping a card opens the edit modal; long-pressing a card starts a drag; scrolling a column doesn't trigger an accidental drag
- [ ] Kanban Board on desktop: click opens modal, mouse-drag (5 px) reorders — unchanged from today
- [ ] Pomodoro Timer on iPhone Safari (browser tab): the permission hint includes the "install to home screen" line
- [ ] Build passes (`tsc && vite build`)

## Constraints

- **No new dependencies.** dnd-kit's `MouseSensor` and `TouchSensor` already ship in `@dnd-kit/core`.
- **No `any`.** The `useMediaQuery` hook is fully typed.
- **Dark mode + focus-visible rings** on every new UI element (error banner, etc.).
- **Don't change unrelated behavior** in any app. The diff per app should be small and obviously additive (responsive variants, pointer-event renames, sensor swap, banner add).
- **Touch multi-select is explicitly out of scope.** The tip line documents this; users wanting multi-word annotations use desktop. Revisit only if iPhone users report it as a real need.

## Test plan

1. `npm install` (no new deps, but make sure lockfile is consistent)
2. `npm run build` — TypeScript + Vite must pass
3. `npm run dev` — exercise each fix at both ≤ 375 px (Chrome devtools mobile emulation) and ≥ 1024 px
4. Install the dev build on an iPhone (Safari → Add to Home Screen) and walk through:
   - Doc Viewer: upload a PDF, run OCR, tap a word
   - Kanban: tap to open modal; long-press to drag-reorder
   - JSON Explorer: paste JSON, tap a copy button
   - Code Snapshot: try Download PNG; if it fails, the banner should appear
   - Pomodoro: confirm the iOS install hint is visible until you install to home screen and start the timer there
