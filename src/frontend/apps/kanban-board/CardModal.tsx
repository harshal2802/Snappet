import { useState, useEffect, useRef } from 'react'
import type { Card, CardColor } from './types'

const COLORS: CardColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

const COLOR_CLASSES: Record<CardColor, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
}

const COLOR_RING_CLASSES: Record<CardColor, string> = {
  red: 'ring-red-500',
  orange: 'ring-orange-500',
  yellow: 'ring-yellow-400',
  green: 'ring-green-500',
  blue: 'ring-blue-500',
  purple: 'ring-purple-500',
}

interface CardModalProps {
  card: Card
  onSave: (updated: Card) => void
  onDelete: () => void
  onClose: () => void
}

export default function CardModal({ card, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [color, setColor] = useState<CardColor>(card.color)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ ...card, title: trimmed, description: description.trim(), color })
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Card</h2>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            placeholder="Card title"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
            placeholder="Optional description..."
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Color Label
          </label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full ${COLOR_CLASSES[c]} transition-all focus:outline-none ${
                  color === c ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ${COLOR_RING_CLASSES[c]}` : 'hover:scale-110'
                }`}
                aria-label={`Select ${c} color`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Delete Card
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
