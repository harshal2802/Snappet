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
    path: '/doc-viewer',
    label: 'Document Viewer',
    description: 'View PDFs and images with full-featured viewer and OCR text extraction.',
    category: 'Utilities',
    icon: '📄',
    component: lazy(() => import('../apps/doc-viewer')),
  },
]
