import { useMemo, useState } from 'react'
import type { Annotation, AnnotationColor } from './types'

interface AnnotationsListViewProps {
  annotations: Annotation[]
  selectedWordIds: string[]
  onJump: (annotation: Annotation) => void
  onRemove: (annotationId: string) => void
  onUpdateNote: (annotationId: string, note: string) => void
}

type SortKey = 'page' | 'newest' | 'color'

const COLOR_DOT: Record<AnnotationColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  pink: 'bg-pink-300',
  blue: 'bg-blue-300',
}

const COLOR_ORDER: Record<AnnotationColor, number> = {
  yellow: 0,
  green: 1,
  pink: 2,
  blue: 3,
}

const SORT_LABEL: Record<SortKey, string> = {
  page: 'Page',
  newest: 'Newest',
  color: 'Color',
}

export default function AnnotationsListView({
  annotations,
  selectedWordIds,
  onJump,
  onRemove,
  onUpdateNote,
}: AnnotationsListViewProps) {
  const [sort, setSort] = useState<SortKey>('page')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const selectedSet = useMemo(() => new Set(selectedWordIds), [selectedWordIds])

  const sorted = useMemo(() => {
    const copy = [...annotations]
    switch (sort) {
      case 'newest':
        copy.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'color':
        copy.sort(
          (a, b) =>
            COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || a.pageIndex - b.pageIndex,
        )
        break
      case 'page':
      default:
        copy.sort((a, b) => a.pageIndex - b.pageIndex || a.createdAt - b.createdAt)
        break
    }
    return copy
  }, [annotations, sort])

  function isCurrent(ann: Annotation): boolean {
    if (ann.wordIds.length !== selectedSet.size) return false
    return ann.wordIds.every((id) => selectedSet.has(id))
  }

  function startEdit(ann: Annotation) {
    setEditingId(ann.id)
    setNoteDraft(ann.note)
  }

  function commitEdit(ann: Annotation) {
    if (noteDraft !== ann.note) onUpdateNote(ann.id, noteDraft)
    setEditingId(null)
  }

  if (annotations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No annotations yet. Select some words in the Text tab, then pick a color.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Sort
        </span>
        {(['page', 'newest', 'color'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            aria-pressed={sort === k}
            className={`px-2 py-0.5 rounded text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              sort === k
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {SORT_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.map((ann) => {
          const isActive = isCurrent(ann)
          const isEditing = editingId === ann.id
          const preview = ann.text.length > 60 ? `${ann.text.slice(0, 60)}…` : ann.text
          return (
            <div
              key={ann.id}
              className={`rounded-lg border bg-white dark:bg-gray-800 overflow-hidden transition-colors ${
                isActive
                  ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onJump(ann)}
                    className="flex items-start gap-2 min-w-0 flex-1 text-left focus:outline-none focus-visible:underline"
                  >
                    <span
                      className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOT[ann.color]}`}
                      aria-label={ann.color}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                        {preview}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        Page {ann.pageIndex + 1} · {ann.wordIds.length} word
                        {ann.wordIds.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => onRemove(ann.id)}
                    title="Remove annotation"
                    aria-label="Remove annotation"
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded p-0.5"
                  >
                    ✕
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => commitEdit(ann)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setNoteDraft(ann.note)
                        setEditingId(null)
                      }
                    }}
                    autoFocus
                    rows={2}
                    placeholder="Add a note…"
                    className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(ann)}
                    className="block w-full text-left text-xs text-gray-600 dark:text-gray-400 italic hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline"
                  >
                    {ann.note || 'Add a note…'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
