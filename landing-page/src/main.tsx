import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { initAnalytics } from './services/analytics'
import { initGoogleTag } from './consent/googleTag'
import { loadPost } from './data/blogLoader'
import { LEGAL_PATHS, loadLegal } from './data/legalLoader'
import { loadSeoContent } from './data/seoContentLoader'
import { findSeoPage, seoSlug } from './data/seoPages'
import { PHOTO_CHECKER_PATH } from './data/photoChecker'
import { loadPhotoChecker } from './data/photoCheckerLoader'

initAnalytics()
initGoogleTag()

const container = document.getElementById('root')!
const app = (
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
)

// Production pages are prerendered (SSG) – hydrate instead of re-rendering from scratch.
// Article, landing, legal and tool pages first fetch their content chunk so the hydrated tree equals the static HTML.
const path = window.location.pathname.replace(/\/$/, '') || '/'
const articleSlug = path.match(/^\/blog\/([a-z0-9-]+)$/)?.[1]
const legalDoc = LEGAL_PATHS[path]
const seoPage = findSeoPage(path)
const ready: Promise<unknown> = articleSlug
  ? loadPost(articleSlug).catch(() => null)
  : seoPage
    ? loadSeoContent(seoSlug(seoPage)).catch(() => null)
    : legalDoc
      ? loadLegal(legalDoc).catch(() => null)
      : path === PHOTO_CHECKER_PATH
        ? loadPhotoChecker().catch(() => null)
        : Promise.resolve(null)

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
