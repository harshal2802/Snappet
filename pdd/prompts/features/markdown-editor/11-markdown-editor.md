# Markdown Editor Mini-App

## Goal

Build a split-pane Markdown editor with live preview, formatting toolbar, and export options as a Snappet mini-app.

## Features

1. **Split-pane layout**: Side-by-side editor (monospace textarea) and rendered HTML preview on desktop; tabbed Edit/Preview toggle on mobile.
2. **Formatting toolbar**: Buttons that insert Markdown syntax at cursor position (Bold, Italic, Heading cycle, Link, Image, Inline Code, Code Block, Bulleted List, Numbered List, Blockquote, Horizontal Rule, Table template).
3. **Markdown rendering**: GitHub Flavored Markdown via `react-markdown` + `remark-gfm`, syntax-highlighted code blocks via `react-syntax-highlighter`, styled with Tailwind Typography `prose` / `prose-invert`.
4. **Export options**: Copy HTML, Copy Markdown, Download `.md` file.
5. **Stats bar**: Word count, character count, line count, reading time estimate (~200 wpm).
6. **Default content**: Pre-populated Markdown cheatsheet demonstrating all supported features.
7. **Persistence**: Content and view mode saved to localStorage via `useLocalStorage`.
8. **Reset button**: Restores the default cheatsheet content.

## Technical Stack

- React 18 + TypeScript (strict, no `any`)
- Tailwind CSS with dark mode (`dark:` classes)
- `react-markdown`, `remark-gfm`, `react-syntax-highlighter`, `@tailwindcss/typography`
- Plain `<textarea>` with ref-based cursor manipulation for toolbar actions

## Files

- `src/frontend/apps/markdown-editor/index.tsx` — main component
- `src/frontend/apps/markdown-editor/Toolbar.tsx` — formatting toolbar
- `src/frontend/apps/markdown-editor/Preview.tsx` — rendered preview pane
- `src/frontend/apps/markdown-editor/types.ts` — shared types
- `src/frontend/router/routes.tsx` — route entry
- `src/frontend/tailwind.config.ts` — typography plugin added

## Acceptance Criteria

- [ ] Typing markdown renders live preview
- [ ] All toolbar buttons insert correct syntax at cursor position
- [ ] GFM features render (tables, task lists, strikethrough)
- [ ] Code blocks have syntax highlighting
- [ ] Export buttons work (Copy HTML, Copy Markdown, Download .md)
- [ ] Stats bar shows correct counts
- [ ] Dark mode works on all elements
- [ ] Mobile shows Edit/Preview tabs
- [ ] Reset button restores default content
- [ ] State persists across page reloads
- [ ] Build passes (`tsc && vite build`)
