import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensors,
  useSensor,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import type { Board, Card, Column as ColumnType } from './types'
import Column from './Column'
import CardModal from './CardModal'
import KanbanCard from './KanbanCard'
import { generateId } from './utils'
import GuidedTour from '../../components/GuidedTour'
import { tourSteps } from './tour'

function createDefaultBoard(): Board {
  return [
    { id: generateId(), title: 'To Do', cards: [] },
    { id: generateId(), title: 'In Progress', cards: [] },
    { id: generateId(), title: 'Done', cards: [] },
  ]
}

function findColumnByCardId(board: Board, cardId: string): ColumnType | undefined {
  return board.find((col) => col.cards.some((c) => c.id === cardId))
}

export default function KanbanBoard() {
  const [board, setBoard] = useLocalStorage<Board>('snappet:kanban:board', createDefaultBoard())
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [editingCard, setEditingCard] = useState<Card | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      // Long-press 200ms with 5px tolerance — clearly separates "tap to open
      // the card modal" from "drag to reorder" on touch.
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  )

  function handleReset() {
    setBoard(createDefaultBoard())
    setActiveCard(null)
    setEditingCard(null)
  }

  // -- Column management --

  function addColumn() {
    const newCol: ColumnType = {
      id: generateId(),
      title: 'New Column',
      cards: [],
    }
    setBoard((prev) => [...prev, newCol])
  }

  function updateColumnTitle(columnId: string, title: string) {
    setBoard((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, title } : col))
    )
  }

  function deleteColumn(columnId: string) {
    setBoard((prev) => {
      const column = prev.find((col) => col.id === columnId)
      if (!column) return prev
      const remaining = prev.filter((col) => col.id !== columnId)
      if (remaining.length === 0) return prev
      // Move cards to first remaining column
      if (column.cards.length > 0) {
        return remaining.map((col, i) =>
          i === 0 ? { ...col, cards: [...col.cards, ...column.cards] } : col
        )
      }
      return remaining
    })
  }

  // -- Card management --

  function addCardToColumn(columnId: string, card: Card) {
    setBoard((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
      )
    )
  }

  function updateCard(updatedCard: Card) {
    setBoard((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
      }))
    )
    setEditingCard(null)
  }

  function deleteCard(cardId: string) {
    setBoard((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== cardId),
      }))
    )
    setEditingCard(null)
  }

  // -- Drag and Drop --

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const col = findColumnByCardId(board, active.id as string)
      const card = col?.cards.find((c) => c.id === active.id)
      setActiveCard(card ?? null)
    },
    [board]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      if (activeId === overId) return

      setBoard((prev) => {
        const sourceCol = prev.find((col) => col.cards.some((c) => c.id === activeId))
        if (!sourceCol) return prev

        // Check if over is a column id (dropping into empty column)
        const overIsColumn = prev.some((col) => col.id === overId)
        const destCol = overIsColumn
          ? prev.find((col) => col.id === overId)
          : prev.find((col) => col.cards.some((c) => c.id === overId))

        if (!destCol || sourceCol.id === destCol.id) return prev

        // Move card from source to destination
        const activeCard = sourceCol.cards.find((c) => c.id === activeId)
        if (!activeCard) return prev

        const overIndex = overIsColumn
          ? destCol.cards.length
          : destCol.cards.findIndex((c) => c.id === overId)

        return prev.map((col) => {
          if (col.id === sourceCol.id) {
            return { ...col, cards: col.cards.filter((c) => c.id !== activeId) }
          }
          if (col.id === destCol.id) {
            const newCards = [...col.cards]
            newCards.splice(overIndex, 0, activeCard)
            return { ...col, cards: newCards }
          }
          return col
        })
      })
    },
    [setBoard]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveCard(null)

      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      if (activeId === overId) return

      setBoard((prev) => {
        const col = prev.find((c) => c.cards.some((card) => card.id === activeId))
        if (!col) return prev

        // Only handle reordering within the same column here
        // Cross-column moves are handled in dragOver
        const activeIndex = col.cards.findIndex((c) => c.id === activeId)
        const overIndex = col.cards.findIndex((c) => c.id === overId)

        if (activeIndex === -1 || overIndex === -1) return prev

        return prev.map((c) =>
          c.id === col.id
            ? { ...c, cards: arrayMove(c.cards, activeIndex, overIndex) }
            : c
        )
      })
    },
    [setBoard]
  )

  function handleCardClick(card: Card) {
    // Only open modal if not dragging
    if (!activeCard) {
      setEditingCard(card)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Kanban Board
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Organize tasks with drag-and-drop columns and cards.
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <GuidedTour appId="kanban-board" steps={tourSteps} />
          <button
            onClick={handleReset}
            data-tour="reset"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none" data-tour="board">
          {board.map((col, colIndex) => (
            <div key={col.id} className="snap-center" data-tour={colIndex === 0 ? 'add-card' : undefined}>
              <Column
                columnId={col.id}
                title={col.title}
                cards={col.cards}
                onTitleChange={(title) => updateColumnTitle(col.id, title)}
                onDelete={() => deleteColumn(col.id)}
                onAddCard={(card) => addCardToColumn(col.id, card)}
                onCardClick={handleCardClick}
                canDelete={board.length > 1}
              />
            </div>
          ))}

          {/* Add Column Button */}
          <button
            onClick={addColumn}
            data-tour="add-column"
            className="w-72 min-w-[18rem] flex-shrink-0 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            + Add Column
          </button>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="rotate-2">
              <KanbanCard card={activeCard} onClick={() => undefined} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Edit Card Modal */}
      {editingCard && (
        <CardModal
          card={editingCard}
          onSave={updateCard}
          onDelete={() => deleteCard(editingCard.id)}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  )
}
