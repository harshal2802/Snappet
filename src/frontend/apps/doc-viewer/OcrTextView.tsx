import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  OcrPage,
  OcrParagraph,
  OcrWord,
  Annotation,
  AnnotationColor,
} from './types'

interface OcrTextViewProps {
  pages: OcrPage[]
  allWordsOrdered: OcrWord[]
  selectedWordIds: string[]
  selectedWords: OcrWord[]
  annotationByWordId: Map<string, Annotation>
  onSetSelection: (wordIds: string[]) => void
  onApplyColorToSelection: (color: AnnotationColor) => void
  onUpdateNote: (annotationId: string, note: string) => void
}

const COLORS: AnnotationColor[] = ['yellow', 'green', 'pink', 'blue']

const COLOR_SWATCH_BG: Record<AnnotationColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  pink: 'bg-pink-300',
  blue: 'bg-blue-300',
}
const COLOR_RING: Record<AnnotationColor, string> = {
  yellow: 'ring-yellow-500',
  green: 'ring-green-500',
  pink: 'ring-pink-500',
  blue: 'ring-blue-500',
}
const COLOR_INLINE_BG: Record<AnnotationColor, string> = {
  yellow: 'bg-yellow-200/70 dark:bg-yellow-600/40',
  green: 'bg-green-200/70 dark:bg-green-700/40',
  pink: 'bg-pink-200/70 dark:bg-pink-700/40',
  blue: 'bg-blue-200/70 dark:bg-blue-700/40',
}

function pageText(page: OcrPage): string {
  // Words within a line: space. Lines within a paragraph: space (flowing prose).
  // Paragraphs: blank line. Gives clean output for copy/paste.
  return page.blocks
    .flatMap((b) => b.paragraphs)
    .map((p) => p.lines.map((l) => l.words.map((w) => w.text).join(' ')).join(' '))
    .join('\n\n')
}

function wordMatchesSearch(word: OcrWord, term: string): boolean {
  if (!term) return false
  return word.text.toLowerCase().includes(term.toLowerCase())
}

function pageMatchesSearch(page: OcrPage, term: string): boolean {
  if (!term) return true
  return page.words.some((w) => wordMatchesSearch(w, term))
}

function paragraphMatchesSearch(para: OcrParagraph, term: string): boolean {
  if (!term) return true
  return para.lines.some((l) => l.words.some((w) => wordMatchesSearch(w, term)))
}

// Selection helpers — operate on a wordId-indexed Map for O(1) lookup.

function rangeBetween(
  wordOrder: Map<string, number>,
  anchorId: string,
  targetId: string,
  allWords: OcrWord[],
): string[] {
  const a = wordOrder.get(anchorId)
  const b = wordOrder.get(targetId)
  if (a === undefined || b === undefined) return [targetId]
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  return allWords.slice(lo, hi + 1).map((w) => w.id)
}

export default function OcrTextView({
  pages,
  allWordsOrdered,
  selectedWordIds,
  selectedWords,
  annotationByWordId,
  onSetSelection,
  onApplyColorToSelection,
  onUpdateNote,
}: OcrTextViewProps) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(pages.map((p) => [p.pageIndex, true])),
  )
  const [copiedPage, setCopiedPage] = useState<number | 'all' | null>(null)
  const lastSelectedRef = useRef<HTMLSpanElement | null>(null)

  // Document-order index for range computations.
  const wordOrder = useMemo(() => {
    const m = new Map<string, number>()
    allWordsOrdered.forEach((w, i) => m.set(w.id, i))
    return m
  }, [allWordsOrdered])

  // Drag state: anchorId (first word grabbed) — null when not dragging.
  // Selection is updated continuously during the drag.
  const dragAnchorRef = useRef<string | null>(null)
  const dragBaseSelectionRef = useRef<string[]>([])

  // Auto-scroll the last selected word into view
  useEffect(() => {
    if (lastSelectedRef.current) {
      lastSelectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Intentionally key only on the last id — sliding the whole range during a
    // drag shouldn't yank the scroll position around on every word.
  }, [selectedWordIds[selectedWordIds.length - 1]])

  // Auto-expand pages that contain any selected word
  useEffect(() => {
    if (selectedWords.length === 0) return
    const pagesToOpen = new Set(selectedWords.map((w) => w.bbox.pageIndex))
    setExpanded((prev) => {
      const next = { ...prev }
      let changed = false
      for (const idx of pagesToOpen) {
        if (!next[idx]) {
          next[idx] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selectedWords])

  // End drag on window pointerup/cancel so releasing outside any word still
  // works (and iOS pointercancel cleans up if the OS interrupts).
  useEffect(() => {
    function onUp() {
      dragAnchorRef.current = null
      dragBaseSelectionRef.current = []
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const visiblePages = useMemo(
    () => (search ? pages.filter((p) => pageMatchesSearch(p, search)) : pages),
    [pages, search],
  )

  const allExpanded = pages.every((p) => expanded[p.pageIndex])

  function toggleAll() {
    const next = !allExpanded
    setExpanded(Object.fromEntries(pages.map((p) => [p.pageIndex, next])))
  }

  function togglePage(pageIndex: number) {
    setExpanded((prev) => ({ ...prev, [pageIndex]: !prev[pageIndex] }))
  }

  function copy(text: string, marker: number | 'all') {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedPage(marker)
        setTimeout(() => setCopiedPage(null), 1500)
      },
      () => {
        setCopiedPage(null)
      },
    )
  }

  const allText = pages.map((p) => `Page ${p.pageIndex + 1}\n${pageText(p)}`).join('\n\n')

  // ── Selection interactions ──────────────────────────────────────────────────

  const handleWordPointerDown = useCallback(
    (word: OcrWord, e: React.PointerEvent) => {
      // Only respond to primary button (button = 0 covers both mouse left-click
      // and touch — touch always reports button 0).
      if (e.button !== 0) return
      // Prevent native text selection on mouse (no-op for touch).
      e.preventDefault()

      if (e.shiftKey) {
        const anchorId = selectedWordIds[0] ?? word.id
        onSetSelection(rangeBetween(wordOrder, anchorId, word.id, allWordsOrdered))
        return
      }
      if (e.metaKey || e.ctrlKey) {
        const set = new Set(selectedWordIds)
        if (set.has(word.id)) {
          set.delete(word.id)
        } else {
          set.add(word.id)
        }
        onSetSelection(Array.from(set))
        return
      }
      // Plain pointerdown — set single selection. On mouse, the dragAnchor
      // lets subsequent onPointerEnter extend the range; on touch, pointerenter
      // doesn't fire on cross-element finger movement (implicit pointer
      // capture), so this stays a single-tap select.
      dragAnchorRef.current = word.id
      dragBaseSelectionRef.current = []
      onSetSelection([word.id])
    },
    [allWordsOrdered, onSetSelection, selectedWordIds, wordOrder],
  )

  const handleWordPointerEnter = useCallback(
    (word: OcrWord) => {
      const anchor = dragAnchorRef.current
      if (!anchor) return
      onSetSelection(rangeBetween(wordOrder, anchor, word.id, allWordsOrdered))
    },
    [allWordsOrdered, onSetSelection, wordOrder],
  )

  // ── Active annotation (if selection exactly matches one) ────────────────────

  const currentAnnotation: Annotation | null = useMemo(() => {
    if (selectedWordIds.length === 0) return null
    const set = new Set(selectedWordIds)
    // Look up via first selected word; verify exact set match.
    const candidate = annotationByWordId.get(selectedWordIds[0])
    if (!candidate) return null
    if (
      candidate.wordIds.length === set.size &&
      candidate.wordIds.every((id) => set.has(id))
    ) {
      return candidate
    }
    return null
  }, [annotationByWordId, selectedWordIds])

  return (
    <>
      {/* Sticky controls */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-2 bg-gray-50 dark:bg-gray-800/50">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words…"
            className="w-full pl-7 pr-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={toggleAll}
            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            onClick={() => copy(allText, 'all')}
            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline"
          >
            {copiedPage === 'all' ? '✓ Copied' : 'Copy all'}
          </button>
        </div>
      </div>

      {/* Selection annotation controls */}
      {selectedWords.length > 0 && (
        <SelectionControls
          selectedWords={selectedWords}
          currentAnnotation={currentAnnotation}
          onApplyColorToSelection={onApplyColorToSelection}
          onUpdateNote={onUpdateNote}
          onClear={() => onSetSelection([])}
        />
      )}

      {/* Help text if no selection */}
      {selectedWords.length === 0 && (
        <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <span className="hidden sm:inline">Tip: drag across words, or shift+click for a range, or ⌘/Ctrl+click to toggle.</span>
          <span className="sm:hidden">Tip: tap a word to select.</span>
        </div>
      )}

      {/* Pages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visiblePages.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            No pages match "{search}".
          </p>
        )}

        {visiblePages.map((page) => {
          const isOpen = expanded[page.pageIndex] ?? true
          const lowConf = page.words.filter((w) => w.confidence < 60).length
          const paragraphCount = page.blocks.reduce(
            (n, b) => n + b.paragraphs.length,
            0,
          )
          return (
            <div
              key={page.pageIndex}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => togglePage(page.pageIndex)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline"
                >
                  <span className={`inline-block transition-transform text-[10px] ${isOpen ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  Page {page.pageIndex + 1}
                  <span className="font-normal text-gray-400 dark:text-gray-500">
                    · {page.words.length} words
                    {paragraphCount > 1 && ` · ${paragraphCount} paragraphs`}
                    {lowConf > 0 && <span className="text-amber-600 dark:text-amber-400"> · {lowConf} low-conf</span>}
                  </span>
                </button>
                <button
                  onClick={() => copy(pageText(page), page.pageIndex)}
                  className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline"
                >
                  {copiedPage === page.pageIndex ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {isOpen && (
                <div
                  className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed px-3 py-2.5 select-none"
                  // Suppress browser drag-image / native selection during our custom drag
                  onDragStart={(e) => e.preventDefault()}
                >
                  {page.blocks.map((block, bi) => {
                    const showBlockWrapper = page.blocks.length > 1
                    return (
                      <div
                        key={bi}
                        className={
                          showBlockWrapper
                            ? 'mb-3 last:mb-0 pl-2 border-l-2 border-gray-200 dark:border-gray-700'
                            : ''
                        }
                      >
                        {block.paragraphs.map((para, pi) => {
                          if (search !== '' && !paragraphMatchesSearch(para, search)) {
                            return null
                          }
                          return (
                            <p key={pi} className="mb-2 last:mb-0">
                              {para.lines.map((line, li) => (
                                <span key={li}>
                                  {li > 0 && <br />}
                                  {line.words.map((word) => {
                                    const isSelected = selectedWordIds.includes(word.id)
                                    const isLastSelected =
                                      isSelected &&
                                      word.id === selectedWordIds[selectedWordIds.length - 1]
                                    const isLowConf = word.confidence < 60
                                    const isMatch =
                                      search !== '' && wordMatchesSearch(word, search)
                                    const isDimmed = search !== '' && !isMatch
                                    const ann = annotationByWordId.get(word.id)

                                    return (
                                      <span
                                        key={word.id}
                                        ref={isLastSelected ? lastSelectedRef : null}
                                      >
                                        <span
                                          onPointerDown={(e) => handleWordPointerDown(word, e)}
                                          onPointerEnter={() => handleWordPointerEnter(word)}
                                          title={
                                            isLowConf
                                              ? `Low confidence (${Math.round(word.confidence)}%)`
                                              : undefined
                                          }
                                          className={`
                                            cursor-pointer rounded px-0.5 transition-colors duration-100
                                            ${isSelected ? 'outline outline-2 outline-yellow-500' : ''}
                                            ${ann && !isSelected ? COLOR_INLINE_BG[ann.color] : ''}
                                            ${!ann && !isSelected ? 'hover:bg-blue-100 dark:hover:bg-blue-900/40' : ''}
                                            ${isMatch ? 'underline decoration-2 decoration-blue-500' : ''}
                                            ${isDimmed ? 'opacity-30' : ''}
                                            ${isLowConf ? 'opacity-60' : ''}
                                          `}
                                        >
                                          {word.text}
                                        </span>
                                        {' '}
                                      </span>
                                    )
                                  })}
                                </span>
                              ))}
                            </p>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Selection controls (apply color, edit note) ───────────────────────────────

interface SelectionControlsProps {
  selectedWords: OcrWord[]
  currentAnnotation: Annotation | null
  onApplyColorToSelection: (color: AnnotationColor) => void
  onUpdateNote: (annotationId: string, note: string) => void
  onClear: () => void
}

function SelectionControls({
  selectedWords,
  currentAnnotation,
  onApplyColorToSelection,
  onUpdateNote,
  onClear,
}: SelectionControlsProps) {
  const [noteDraft, setNoteDraft] = useState(currentAnnotation?.note ?? '')

  useEffect(() => {
    setNoteDraft(currentAnnotation?.note ?? '')
  }, [currentAnnotation?.id])

  const preview =
    selectedWords.length === 1
      ? selectedWords[0].text
      : selectedWords.map((w) => w.text).join(' ')
  const truncated = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview

  return (
    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-blue-50/60 dark:bg-blue-950/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-semibold">
              {selectedWords.length === 1
                ? `Selected · Page ${selectedWords[0].bbox.pageIndex + 1}`
                : `${selectedWords.length} words selected`}
            </p>
            <button
              onClick={onClear}
              title="Clear selection"
              className="text-[10px] text-blue-600/70 dark:text-blue-400/70 hover:text-blue-700 dark:hover:text-blue-300 underline focus:outline-none"
            >
              clear
            </button>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {truncated}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {COLORS.map((c) => {
            const isCurrent = currentAnnotation?.color === c
            return (
              <button
                key={c}
                onClick={() => onApplyColorToSelection(c)}
                aria-label={`Highlight ${c}`}
                title={isCurrent ? `Remove ${c} highlight` : `Highlight ${c}`}
                className={`
                  w-5 h-5 rounded-full ${COLOR_SWATCH_BG[c]}
                  ${isCurrent ? `ring-2 ring-offset-1 ring-offset-blue-50 dark:ring-offset-blue-950 ${COLOR_RING[c]}` : 'hover:scale-110'}
                  transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:${COLOR_RING[c]}
                `}
              />
            )
          })}
        </div>
      </div>

      {currentAnnotation && (
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== currentAnnotation.note) {
              onUpdateNote(currentAnnotation.id, noteDraft)
            }
          }}
          rows={2}
          placeholder="Add a note…"
          className="w-full px-2 py-1.5 rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      )}
    </div>
  )
}
