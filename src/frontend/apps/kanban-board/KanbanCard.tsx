import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card, CardColor } from './types'

const COLOR_DOT_CLASSES: Record<CardColor, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return `${Math.floor(diffDay / 30)}mo ago`
}

interface KanbanCardProps {
  card: Card
  onClick: () => void
}

export default function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`rounded-xl bg-white dark:bg-gray-700 p-3 shadow-sm border border-gray-200 dark:border-gray-600 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isDragging ? 'shadow-lg opacity-90 rotate-2 z-50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOT_CLASSES[card.color]}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
            {card.title}
          </p>
          {card.description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 break-words">
              {card.description}
            </p>
          )}
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            {formatRelativeTime(card.createdAt)}
          </p>
        </div>
      </div>
    </div>
  )
}
