import { lazy } from 'react'
import type { ComponentType } from 'react'

export interface AppRoute {
  path: string
  label: string
  component: ComponentType
}

// Add new mini-apps here — lazy-loaded automatically
export const routes: AppRoute[] = [
  {
    path: '/example',
    label: 'Example',
    component: lazy(() => import('../apps/example')),
  },
]
