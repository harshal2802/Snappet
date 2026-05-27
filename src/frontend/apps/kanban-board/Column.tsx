import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Card, CardColor } from './types'
import KanbanCard from './KanbanCard'
import { generateId } from './utils'

const DEFAULT_COLOR: CardColor = 'blue'

interface ColumnProps {
  columnId: string
  title: string
  cards: Card[]
  onTitleChange: (title: string) => void
  onDelete: () => void
  onAddCard: (card: Card) => void
  onCardClick: (card: Card) => void
  canDelete: boolean
}

export default function Column({
  columnId,
  title,
  cards,
  onTitleChange,
  onDelete,
  onAddCard,
  onCardClick,
  canDelete,
}: ColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const addCardInputRef = useRef<HTMLInputElement>(null)

  const { setNodeRef } = useDroppable({ id: columnId })

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
  }, [isEditingTitle])

  useEffect(() => {
    if (showAddForm) {
      addCardInputRef.current?.focus()
    }
  }, [showAddForm])

  function handleTitleSave() {
    const trimmed = editTitle.trim()
    if (trimmed) {
      onTitleChange(trimmed)
    } else {
      setEditTitle(title)
    }
    setIsEditingTitle(false)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleTitleSave()
    if (e.key === 'Escape') {
      setEditTitle(title)
      setIsEditingTitle(false)
    }
  }

  function handleAddCard() {
    const trimmed = newCardTitle.trim()
    if (!trimmed) return
    const card: Card = {
      id: generateId(),
      title: trimmed,
      description: '',
      color: DEFAULT_COLOR,
      createdAt: Date.now(),
    }
    onAddCard(card)
    setNewCardTitle('')
    addCardInputRef.current?.focus()
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAddCard()
    if (e.key === 'Escape') {
      setShowAddForm(false)
      setNewCardTitle('')
    }
  }

  return (
    <div className="w-72 min-w-[18rem] flex-shrink-0 rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3 flex flex-col max-h-[calc(100vh-12rem)]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="flex-1 text-sm font-semibold px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            onClick={() => {
              setEditTitle(title)
              setIsEditingTitle(true)
            }}
            className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
          >
            {title}{' '}
            <span className="text-gray-400 dark:text-gray-500 font-normal">
              ({cards.length})
            </span>
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            title={cards.length > 0 ? 'Cards will be moved to first column' : 'Delete empty column'}
            className="ml-2 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={`Delete column ${title}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Cards List */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto space-y-2 min-h-[2rem]">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
            No cards yet
          </div>
        )}
      </div>

      {/* Add Card */}
      <div className="mt-2">
        {showAddForm ? (
          <div className="space-y-2">
            <input
              ref={addCardInputRef}
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Card title..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddCard}
                disabled={!newCardTitle.trim()}
                className="px-3 py-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewCardTitle('')
                }}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  )
}
