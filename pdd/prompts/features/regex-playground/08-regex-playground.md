# Prompt: Regex Playground

**File**: pdd/prompts/features/regex-playground/08-regex-playground.md
**Created**: 2026-05-26
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Regex Playground mini-app at `/regex-playground`. It lets users test, debug, and understand regular expressions in real time — like a mini regex101.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy, mobile-first), React Router v6, Vite. No new dependencies.

**Conventions**:
- Functional components, no class components
- Tailwind utility classes only — no inline styles
- No `any` — all types explicit
- Files go in `src/frontend/apps/regex-playground/`
- Default export from `index.tsx`
- State persistence via `useLocalStorage` hook with `snappet:regex:*` keys
- Reset button to clear all state

## Task

Build a Regex Playground mini-app with:

1. **Pattern input** with monospace font and flag toggles (g, i, m, s) as pill buttons
2. **Test string textarea** with inline match highlighting using colored spans
3. **Match details panel** listing all matches with full match text, start/end index, and capture groups
4. **Pattern explanation panel** that tokenizes the regex and shows plain-English explanations
5. **Common patterns library** (collapsible) with pre-built patterns and "Use" buttons

## Input

Fresh folder `src/frontend/apps/regex-playground/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. Types — `src/frontend/apps/regex-playground/types.ts`

Type definitions for RegexFlag, MatchResult, CaptureGroup, ExplainerToken, and CommonPattern.

### 2. Explainer — `src/frontend/apps/regex-playground/explainer.ts`

A tokenizer that walks a regex pattern string character by character, recognizing escape sequences, character classes, quantifiers, groups, and metacharacters, producing an array of ExplainerToken objects with plain-English descriptions.

### 3. Patterns — `src/frontend/apps/regex-playground/patterns.ts`

Array of CommonPattern objects: Email, URL, Phone (US), IPv4, Date (YYYY-MM-DD), Hex Color, HTML Tag, CSS Class.

### 4. Main component — `src/frontend/apps/regex-playground/index.tsx`

The default-exported RegexPlayground component. Uses `useLocalStorage` for pattern, flags, and test string. Uses `RegExp` constructor with try/catch for validation. Uses `matchAll` for finding matches. Highlights matches in the test string preview with colored spans.

## Acceptance criteria

- [ ] Valid regex patterns produce highlighted matches in the test string
- [ ] Invalid regex patterns show a clear error message
- [ ] Flag toggles (g, i, m, s) change matching behavior in real time
- [ ] Capture groups are shown with distinct colors in match details
- [ ] Pattern explanation correctly tokenizes and explains common regex tokens
- [ ] Common patterns load correctly when "Use" button is clicked
- [ ] Dark mode works on all elements
- [ ] Mobile-responsive layout (single column on mobile, two columns on desktop)
- [ ] Reset button clears all state to defaults
- [ ] State persists via localStorage across page reloads
- [ ] Build passes (`tsc && vite build`)
- [ ] No `any` types
