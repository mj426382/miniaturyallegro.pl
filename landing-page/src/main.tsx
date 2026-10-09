import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { initAnalytics } from './services/analytics'
import { initGoogleAds } from './consent/googleAds'
import { loadPost } from './data/blogLoader'
import { LEGAL_PATHS, loadLegal } from './data/legalLoader'

initAnalytics()
initGoogleAds()

const container = document.getElementById('root')!
const app = (
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
)

// Production pages are prerendered (SSG) – hydrate instead of re-rendering from scratch.
// Article and legal pages first fetch their content chunk so the hydrated tree equals the static HTML.
const path = window.location.pathname.replace(/\/$/, '') || '/'
const articleSlug = path.match(/^\/blog\/([a-z0-9-]+)$/)?.[1]
const legalDoc = LEGAL_PATHS[path]
const ready: Promise<unknown> = articleSlug ? loadPost(articleSlug).catch(() => null) : legalDoc ? loadLegal(legalDoc).catch(() => null) : Promise.resolve(null)

ready.then(() => {
  if (container.hasChildNodes()) {
    ReactDOM.hydrateRoot(container, app, {
      // Surfaces hydration mismatches with the component stack even in production builds.
      onRecoverableError: (error, info) => {
        const stack = (info.componentStack || '').split('\n').filter(Boolean).slice(0, 6).join(' > ')
        console.error('[hydration]', String(error).slice(0, 160), stack)
      },
    })
  } else {
    ReactDOM.createRoot(container).render(app)
  }
})
