import { useRef, useCallback, useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import Toolbar from './Toolbar'
import Preview from './Preview'
import type { ViewMode, MarkdownStats } from './types'

const DEFAULT_MARKDOWN = `# Markdown Cheatsheet

Welcome to the **Markdown Editor**! This cheatsheet shows off all the supported features.

---

## Text Formatting

You can write **bold text**, *italic text*, ~~strikethrough~~, and \`inline code\`.

## Headings

# Heading 1
## Heading 2
### Heading 3

## Links & Images

[Visit GitHub](https://github.com)

![Placeholder Image](https://via.placeholder.com/150)

## Lists

### Unordered List
- Item one
- Item two
  - Nested item
- Item three

### Ordered List
1. First item
2. Second item
3. Third item

### Task List
- [x] Write the press release
- [ ] Update the website
- [ ] Contact the media

## Blockquote

> "The best way to predict the future is to invent it."
> -- Alan Kay

## Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fibonacci(10)))
\`\`\`

## Tables

| Feature       | Status | Notes            |
| ------------- | ------ | ---------------- |
| Bold          | Done   | Uses \`**text**\`  |
| Italic        | Done   | Uses \`*text*\`    |
| Tables        | Done   | GFM supported    |
| Task Lists    | Done   | GFM supported    |

## Horizontal Rule

---

## Math-like formatting

E = mc^2 (superscripts not supported, but you can write math expressions in code blocks)

---

*Happy writing!*
`

function computeStats(text: string): MarkdownStats {
  const trimmed = text.trim()
  const characters = text.length
  const lines = text.split('\n').length
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
  const minutes = Math.ceil(words / 200)
  const readingTime = minutes <= 1 ? '< 1 min' : `${minutes} min`

  return { words, characters, lines, readingTime }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // Clipboard API not available
  })
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const EXPORT_BTN =
  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useLocalStorage<string>(
    'snappet:markdown:content',
    DEFAULT_MARKDOWN
  )
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    'snappet:markdown:viewMode',
    'edit'
  )

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const stats = useMemo(() => computeStats(markdown), [markdown])

  const handleReset = useCallback(() => {
    setMarkdown(DEFAULT_MARKDOWN)
    setViewMode('edit')
  }, [setMarkdown, setViewMode])

  const handleCopyHtml = useCallback(() => {
    const previewEl = document.querySelector('[data-preview-content]')
    if (previewEl) {
      copyToClipboard(previewEl.innerHTML)
    }
  }, [])

  const handleCopyMarkdown = useCallback(() => {
    copyToClipboard(markdown)
  }, [markdown])

  const handleDownload = useCallback(() => {
    downloadFile(markdown, 'document.md')
  }, [markdown])

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Markdown Editor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Write and preview Markdown with live rendering and export.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          ↺ Reset
        </button>
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleCopyHtml} className={EXPORT_BTN}>
          Copy HTML
        </button>
        <button onClick={handleCopyMarkdown} className={EXPORT_BTN}>
          Copy Markdown
        </button>
        <button onClick={handleDownload} className={EXPORT_BTN}>
          Download .md
        </button>
      </div>

      {/* Mobile view toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-fit md:hidden">
        <button
          onClick={() => setViewMode('edit')}
          aria-pressed={viewMode === 'edit'}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            viewMode === 'edit'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setViewMode('preview')}
          aria-pressed={viewMode === 'preview'}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            viewMode === 'preview'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Toolbar */}
      <div
        className={`${viewMode === 'preview' ? 'hidden md:block' : 'block'}`}
      >
        <Toolbar textareaRef={textareaRef} value={markdown} setValue={setMarkdown} />
      </div>

      {/* Editor + Preview panes */}
      <div className="flex flex-col md:flex-row rounded-b-2xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[500px] overflow-hidden -mt-4">
        {/* Editor pane */}
        <div
          className={`flex-1 ${
            viewMode === 'preview' ? 'hidden md:block' : 'block'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck={false}
            className="w-full h-full min-h-[500px] resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm p-4 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Write your Markdown here..."
          />
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-gray-200 dark:bg-gray-700" />

        {/* Preview pane */}
        <div
          className={`flex-1 bg-white dark:bg-gray-900 overflow-y-auto ${
            viewMode === 'edit' ? 'hidden md:block' : 'block'
          }`}
          data-preview-content
        >
          <Preview markdown={markdown} />
        </div>
      </div>

      {/* Stats bar */}
      <div className="border border-gray-200 dark:border-gray-700 border-t bg-gray-50 dark:bg-gray-800 px-4 py-1 text-xs text-gray-500 dark:text-gray-400 rounded-b-lg flex flex-wrap gap-4 -mt-4">
        <span>{stats.words} words</span>
        <span>{stats.characters} characters</span>
        <span>{stats.lines} lines</span>
        <span>{stats.readingTime} read</span>
      </div>
    </div>
  )
}
