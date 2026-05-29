import { lazy } from 'react'
import type { ComponentType } from 'react'
import { catalog } from '../seo/catalog'
import type { AppCategory, AppMeta } from '../seo/catalog'

export type { AppCategory }

export interface AppRoute extends AppMeta {
  component: ComponentType
}

// Lazy loaders keyed by path. Metadata lives in seo/catalog.ts (single source of
// truth shared with SEO + the build-time prerenderer); this map only wires each
// path to its component bundle.
const loaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  '/example': () => import('../apps/example'),
  '/tip-calculator': () => import('../apps/tip-calculator'),
  '/expense-splitter': () => import('../apps/expense-splitter'),
  '/kanban-board': () => import('../apps/kanban-board'),
  '/json-explorer': () => import('../apps/json-explorer'),
  '/regex-playground': () => import('../apps/regex-playground'),
  '/code-snapshot': () => import('../apps/code-snapshot'),
  '/markdown-editor': () => import('../apps/markdown-editor'),
  '/doc-viewer': () => import('../apps/doc-viewer'),
  '/age-calculator': () => import('../apps/age-calculator'),
  '/pomodoro-timer': () => import('../apps/pomodoro-timer'),
  '/color-picker': () => import('../apps/color-picker'),
  '/password-generator': () => import('../apps/password-generator'),
  '/qr-code': () => import('../apps/qr-code'),
  '/tally-counter': () => import('../apps/tally-counter'),
  '/random-picker': () => import('../apps/random-picker'),
  '/stopwatch': () => import('../apps/stopwatch'),
  '/unit-converter': () => import('../apps/unit-converter'),
  '/workout': () => import('../apps/workout'),
  '/video-editor': () => import('../apps/video-editor'),
}

export const routes: AppRoute[] = catalog
  .filter((m) => loaders[m.path])
  .map((m) => ({ ...m, component: lazy(loaders[m.path]) }))
