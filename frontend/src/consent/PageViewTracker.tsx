import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from './googleTag'

/**
 * GA4 page_view on the first render and on every client-side route change (spec 22, AC-GA-006).
 * The <title> is updated by Helmet asynchronously, so the view is sent a moment after the route changes.
 * Identical copies: landing-page/src/consent/PageViewTracker.tsx and frontend/src/consent/PageViewTracker.tsx.
 */
export default function PageViewTracker() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    const timer = window.setTimeout(trackPageView, 100)
    return () => window.clearTimeout(timer)
  }, [pathname, search])
  return null
}
