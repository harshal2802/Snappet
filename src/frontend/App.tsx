import { Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import { routes } from './router/routes'
import HubPage from './apps/hub'
import { useSeoHead } from './seo/useSeoHead'

function NotFound() {
  return (
    <div className="text-center py-12 text-gray-600 dark:text-gray-400">
      404 — Page not found
    </div>
  )
}

export default function App() {
  // Keep <head> (title/description/canonical/OG) correct on client-side navigation.
  useSeoHead(useLocation().pathname)
  return (
    <>
      <Layout>
        <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HubPage />} />
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={<route.component />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
      <UpdatePrompt />
    </>
  )
}
