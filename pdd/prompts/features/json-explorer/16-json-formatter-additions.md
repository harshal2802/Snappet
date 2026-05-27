# Prompt: JSON Explorer — Copy input + char/line counts

**File**: pdd/prompts/features/json-explorer/16-json-formatter-additions.md
**Created**: 2026-05-27
**Project type**: Frontend / Web app
**Source**: GitHub issue #9 (JSON Formatter)
**Depends on**: pdd/prompts/features/json-explorer/07-json-explorer.md

## Context

Issue #9 asked for a JSON Formatter mini-app with format / minify / validate / copy / char + line counts. The existing JSON Explorer (`/json-explorer`, prompt `07-json-explorer.md`) already covers format, minify, and validate with clear error display.

Rather than ship a second near-duplicate app, extend JSON Explorer with the two missing pieces:
- **Copy** button for the input JSON (alongside Format and Minify)
- **Char + line count** display next to the action buttons

Also broaden the route label/description so users searching "format JSON" find it.

## Task

Edit `src/frontend/apps/json-explorer/index.tsx`:

1. Add `handleCopyInput()` that writes `explorerInput` to the clipboard and surfaces the toast (the app already has a toast surface).
2. In the Explorer mode's action-button row, add the Copy button after Minify, and append a right-aligned `<span>` showing `{N.toLocaleString()} chars · {M} lines` where `M = explorerInput === '' ? 0 : explorerInput.split('\n').length`.

Edit `src/frontend/router/routes.tsx`:

- Rename label `'JSON Explorer'` → `'JSON Explorer & Formatter'`
- Update description to `'Format, minify, validate, explore, and diff JSON — collapsible tree, char/line counts, one-click copy.'`

## Acceptance criteria (mapping issue #9)

- [x] Valid JSON formats and minifies correctly (existing)
- [x] Invalid JSON shows a clear, specific error message (existing)
- [x] Copy to clipboard works for output (new — Copy button)
- [x] Large JSON (10k+ chars) handled without freezing UI (existing; format/minify are O(n))
- [x] Input persisted to localStorage + Reset button (existing)
- [x] Works on mobile (375px) (existing; the new count badge wraps below the buttons on narrow widths)
- [x] Dark mode support (existing)
- [ ] Character and line count display (new)

## Constraints

- Keep changes minimal — no new files, no new dependencies.
- Don't touch the tree view, diff mode, or search code.
- Counts must be O(1) per render — `explorerInput.length` and a single `.split('\n')`. No memoization needed.
