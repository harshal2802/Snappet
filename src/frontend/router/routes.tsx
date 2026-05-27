import { lazy } from 'react'
import type { ComponentType } from 'react'

export type AppCategory =
  | 'Utilities'
  | 'Calculators'
  | 'Productivity'
  | 'Developer Tools'
  | 'Creative'

export interface AppRoute {
  path: string
  label: string
  description: string
  category: AppCategory
  icon: string
  component: ComponentType
}

// Add new mini-apps here — lazy-loaded automatically
export const routes: AppRoute[] = [
  {
    path: '/example',
    label: 'Example',
    description: 'A placeholder mini-app — replace with a real tool.',
    category: 'Utilities',
    icon: '🔧',
    component: lazy(() => import('../apps/example')),
  },
  {
    path: '/tip-calculator',
    label: 'Tip Calculator',
    description: 'Calculate tip and split the bill among friends.',
    category: 'Calculators',
    icon: '💰',
    component: lazy(() => import('../apps/tip-calculator')),
  },
  {
    path: '/expense-splitter',
    label: 'Expense Splitter',
    description: 'Split bills and expenses across a group with custom amounts.',
    category: 'Calculators',
    icon: '🧾',
    component: lazy(() => import('../apps/expense-splitter')),
  },
  {
    path: '/kanban-board',
    label: 'Kanban Board',
    description: 'Organize tasks with a drag-and-drop kanban board.',
    category: 'Productivity',
    icon: '📋',
    component: lazy(() => import('../apps/kanban-board')),
  },
  {
    path: '/json-explorer',
    label: 'JSON Explorer & Formatter',
    description: 'Format, minify, validate, explore, and diff JSON — collapsible tree, char/line counts, one-click copy.',
    category: 'Developer Tools',
    icon: '🔍',
    component: lazy(() => import('../apps/json-explorer')),
  },
  {
    path: '/regex-playground',
    label: 'Regex Playground',
    description: 'Test, debug, and understand regular expressions in real time.',
    category: 'Developer Tools',
    icon: '🔤',
    component: lazy(() => import('../apps/regex-playground')),
  },
  {
    path: '/code-snapshot',
    label: 'Code Snapshot',
    description: 'Generate beautiful code screenshots with customizable themes.',
    category: 'Developer Tools',
    icon: '📸',
    component: lazy(() => import('../apps/code-snapshot')),
  },
  {
    path: '/markdown-editor',
    label: 'Markdown Editor',
    description: 'Write and preview Markdown with live rendering and export.',
    category: 'Productivity',
    icon: '📝',
    component: lazy(() => import('../apps/markdown-editor')),
  },
  {
    path: '/doc-viewer',
    label: 'Document Viewer',
    description: 'View PDFs and images with full-featured viewer and OCR text extraction.',
    category: 'Utilities',
    icon: '📄',
    component: lazy(() => import('../apps/doc-viewer')),
  },
  {
    path: '/age-calculator',
    label: 'Age Calculator',
    description: 'Calculate your exact age, days until your next birthday, and more.',
    category: 'Calculators',
    icon: '🎂',
    component: lazy(() => import('../apps/age-calculator')),
  },
  {
    path: '/pomodoro-timer',
    label: 'Pomodoro Timer',
    description: 'Focus timer with 25-min work sessions and short/long breaks.',
    category: 'Productivity',
    icon: '🍅',
    component: lazy(() => import('../apps/pomodoro-timer')),
  },
  {
    path: '/color-picker',
    label: 'Color Picker & Converter',
    description: 'Convert between HEX, RGB, and HSL with a live preview and contrast checker.',
    category: 'Developer Tools',
    icon: '🎨',
    component: lazy(() => import('../apps/color-picker')),
  },
  {
    path: '/password-generator',
    label: 'Password Generator',
    description: 'Generate strong passwords with custom length, character sets, and a live strength meter.',
    category: 'Utilities',
    icon: '🔑',
    component: lazy(() => import('../apps/password-generator')),
  },
  {
    path: '/stopwatch',
    label: 'Stopwatch',
    description: 'Time anything with lap splits — workouts, cooking, intervals.',
    category: 'Productivity',
    icon: '⏱️',
    component: lazy(() => import('../apps/stopwatch')),
  },
]
