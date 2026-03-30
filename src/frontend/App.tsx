import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { routes } from './router/routes'
import HubPage from './apps/hub'

function NotFound() {
  return (
    <div className="text-center py-12 text-gray-600 dark:text-gray-400">
      404 — Page not found
    </div>
  )
}

export default function App() {
  return (
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
  )
}
