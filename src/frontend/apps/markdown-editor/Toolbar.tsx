import type { RefObject } from 'react'
import type { ToolbarAction } from './types'

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  before: string,
  after: string,
  placeholder: string
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)
  const replacement = selected.length > 0 ? selected : placeholder
  const newText = value.slice(0, start) + before + replacement + after + value.slice(end)
  setValue(newText)
  requestAnimationFrame(() => {
    textarea.focus()
    if (selected.length > 0) {
      textarea.setSelectionRange(start + before.length, start + before.length + replacement.length)
    } else {
      textarea.setSelectionRange(start + before.length, start + before.length + placeholder.length)
    }
  })
}

function insertAtLineStart(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  prefix: string
) {
  const start = textarea.selectionStart
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const newText = value.slice(0, lineStart) + prefix + value.slice(lineStart)
  setValue(newText)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + prefix.length, start + prefix.length)
  })
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  text: string
) {
  const start = textarea.selectionStart
  const newText = value.slice(0, start) + text + value.slice(start)
  setValue(newText)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + text.length, start + text.length)
  })
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    label: 'B',
    icon: 'B',
    tooltip: 'Bold',
    action: (ta, val, set) => wrapSelection(ta, val, set, '**', '**', 'bold text'),
  },
  {
    label: 'I',
    icon: 'I',
    tooltip: 'Italic',
    action: (ta, val, set) => wrapSelection(ta, val, set, '*', '*', 'italic text'),
  },
  {
    label: 'H',
    icon: 'H',
    tooltip: 'Heading (cycles H1/H2/H3)',
    action: (ta, val, set) => {
      const start = ta.selectionStart
      const lineStart = val.lastIndexOf('\n', start - 1) + 1
      const lineEnd = val.indexOf('\n', start)
      const line = val.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)

      if (line.startsWith('### ')) {
        const newText = val.slice(0, lineStart) + line.slice(4) + val.slice(lineEnd === -1 ? val.length : lineEnd)
        set(newText)
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(start - 4, start - 4)
        })
      } else if (line.startsWith('## ')) {
        const newText = val.slice(0, lineStart) + '### ' + line.slice(3) + val.slice(lineEnd === -1 ? val.length : lineEnd)
        set(newText)
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(start + 1, start + 1)
        })
      } else if (line.startsWith('# ')) {
        const newText = val.slice(0, lineStart) + '## ' + line.slice(2) + val.slice(lineEnd === -1 ? val.length : lineEnd)
        set(newText)
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(start + 1, start + 1)
        })
      } else {
        insertAtLineStart(ta, val, set, '# ')
      }
    },
  },
  {
    label: 'Link',
    icon: '🔗',
    tooltip: 'Link',
    action: (ta, val, set) => {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = val.slice(start, end)
      const linkText = selected.length > 0 ? selected : 'link text'
      const insert = `[${linkText}](url)`
      const newText = val.slice(0, start) + insert + val.slice(end)
      set(newText)
      requestAnimationFrame(() => {
        ta.focus()
        const urlStart = start + linkText.length + 3
        ta.setSelectionRange(urlStart, urlStart + 3)
      })
    },
  },
  {
    label: 'Image',
    icon: '🖼',
    tooltip: 'Image',
    action: (ta, val, set) => {
      const start = ta.selectionStart
      const insert = '![alt text](image-url)'
      const newText = val.slice(0, start) + insert + val.slice(ta.selectionEnd)
      set(newText)
      requestAnimationFrame(() => {
        ta.focus()
        const urlStart = start + 12
        ta.setSelectionRange(urlStart, urlStart + 9)
      })
    },
  },
  {
    label: 'Code',
    icon: '</>',
    tooltip: 'Inline Code',
    action: (ta, val, set) => wrapSelection(ta, val, set, '`', '`', 'code'),
  },
  {
    label: 'Code Block',
    icon: '{ }',
    tooltip: 'Code Block',
    action: (ta, val, set) => wrapSelection(ta, val, set, '```\n', '\n```', 'code block'),
  },
  {
    label: 'UL',
    icon: '•',
    tooltip: 'Bulleted List',
    action: (ta, val, set) => insertAtLineStart(ta, val, set, '- '),
  },
  {
    label: 'OL',
    icon: '1.',
    tooltip: 'Numbered List',
    action: (ta, val, set) => insertAtLineStart(ta, val, set, '1. '),
  },
  {
    label: 'Quote',
    icon: '"',
    tooltip: 'Blockquote',
    action: (ta, val, set) => insertAtLineStart(ta, val, set, '> '),
  },
  {
    label: 'HR',
    icon: '―',
    tooltip: 'Horizontal Rule',
    action: (ta, val, set) => insertAtCursor(ta, val, set, '\n---\n'),
  },
  {
    label: 'Table',
    icon: '⊞',
    tooltip: 'Table',
    action: (ta, val, set) =>
      insertAtCursor(
        ta,
        val,
        set,
        '\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n'
      ),
  },
]

interface ToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  setValue: (v: string) => void
}

const BTN_CLASS =
  'px-2 py-1 rounded text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

export default function Toolbar({ textareaRef, value, setValue }: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-t-2xl border border-b-0 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
      {TOOLBAR_ACTIONS.map((action) => (
        <button
          key={action.label}
          title={action.tooltip}
          className={BTN_CLASS}
          onMouseDown={(e) => {
            e.preventDefault()
            const ta = textareaRef.current
            if (ta) action.action(ta, value, setValue)
          }}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}
