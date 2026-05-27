export type ViewMode = 'edit' | 'preview'

export interface ToolbarAction {
  label: string
  icon: string
  tooltip: string
  action: (
    textarea: HTMLTextAreaElement,
    value: string,
    setValue: (v: string) => void
  ) => void
}

export interface MarkdownStats {
  words: number
  characters: number
  lines: number
  readingTime: string
}
