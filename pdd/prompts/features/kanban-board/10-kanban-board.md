# Prompt: Kanban Board

**File**: pdd/prompts/features/kanban-board/10-kanban-board.md
**Created**: 2026-05-26
**Project type**: Frontend / Web app
**Depends on**: pdd/prompts/features/scaffold/01-project-setup.md

## Context

Snappet is a hub of lightweight single-page web apps. This is the Kanban Board mini-app at `/kanban-board`. It provides a polished drag-and-drop task management board with customizable columns and cards.

**Stack**: React 18, TypeScript (strict), Tailwind CSS (`dark:` class strategy, mobile-first), React Router v6, Vite, @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities.

**Conventions**:
- Functional components, no class components
- Tailwind utility classes only — no inline styles
- No `any` — all types explicit
- Files go in `src/frontend/apps/kanban-board/`
- Default export from `index.tsx`
- State persistence via `useLocalStorage` hook from `../../hooks/useLocalStorage`
- Every app must have a Reset button

## Task

Build a Kanban Board mini-app where users manage tasks across customizable columns using drag-and-drop. Default columns: "To Do", "In Progress", "Done". Cards support title, description, color labels, and creation timestamps. The entire board state persists to localStorage.

## Input

Fresh folder `src/frontend/apps/kanban-board/`. The app will be registered in `src/frontend/router/routes.tsx` after generation.

## Output format

Provide full file contents for each file — in this order:

### 1. Types — `src/frontend/apps/kanban-board/types.ts`

```ts
type CardColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'

interface Card {
  id: string        // Math.random().toString(36).slice(2, 9)
  title: string
  description: string
  color: CardColor
  createdAt: number // Date.now()
}

interface Column {
  id: string
  title: string
  cards: Card[]
}

type Board = Column[]
```

### 2. `src/frontend/apps/kanban-board/KanbanCard.tsx`

Draggable card component using `useSortable` from @dnd-kit/sortable. Displays color dot, title, truncated description (line-clamp-2), and relative timestamp. Visual feedback during drag: shadow-lg, opacity-90, rotate-2.

### 3. `src/frontend/apps/kanban-board/CardModal.tsx`

Modal overlay for editing a card. Fields: title input, description textarea, color picker (6 color options as colored circles). Actions: Save, Cancel, Delete (red text button). Closes on Escape or backdrop click.

### 4. `src/frontend/apps/kanban-board/Column.tsx`

Column component with SortableContext wrapping the cards list. Features: editable title (click to edit inline), card count in header, delete column button (moves cards to first column if non-empty), "+ Add card" button with inline form, droppable area via useDroppable.

### 5. `src/frontend/apps/kanban-board/index.tsx`

Top-level component managing board state. Structure:

**Header**: Title "Kanban Board", description, Reset button
**Board**: DndContext wrapping horizontally scrolling flex container of columns, plus "+ Add Column" button
**DragOverlay**: Shows card preview during drag
**CardModal**: Rendered when a card is clicked for editing

**Drag-and-drop logic**:
- useSensors with PointerSensor (activation distance: 5px)
- closestCorners collision detection
- onDragStart: set active card for overlay
- onDragOver: handle cross-column moves
- onDragEnd: handle within-column reordering

### 6. Route registration in `src/frontend/router/routes.tsx`

```ts
{
  path: '/kanban-board',
  label: 'Kanban Board',
  description: 'Organize tasks with a drag-and-drop kanban board.',
  category: 'Productivity',
  icon: '📋',
  component: lazy(() => import('../apps/kanban-board')),
}
```

## Acceptance criteria

- [ ] Default board renders with 3 columns: To Do, In Progress, Done
- [ ] Cards can be added via inline form in each column
- [ ] Cards can be dragged between columns and reordered within columns
- [ ] Clicking a card opens an edit modal
- [ ] Card title, description, and color can be edited in modal
- [ ] Cards can be deleted from modal
- [ ] Columns can be added, renamed (click header), and deleted
- [ ] Card count shown in each column header
- [ ] Board state persists via localStorage
- [ ] Reset button restores default 3-column empty board
- [ ] Dark mode works on all elements
- [ ] Mobile responsive with horizontal scroll
- [ ] Build passes (tsc + vite)
- [ ] No `any` types
