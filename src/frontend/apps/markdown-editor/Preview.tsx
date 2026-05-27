import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'

interface PreviewProps {
  markdown: string
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const codeString = String(children).replace(/\n$/, '')

    if (match) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-lg text-sm"
        >
          {codeString}
        </SyntaxHighlighter>
      )
    }

    return (
      <code
        className={`${className || ''} bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm`}
        {...props}
      >
        {children}
      </code>
    )
  },
}

export default function Preview({ markdown }: PreviewProps) {
  return (
    <div className="prose dark:prose-invert max-w-none p-6 overflow-y-auto h-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
