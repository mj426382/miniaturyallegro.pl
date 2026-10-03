/**
 * Privacy-friendly product analytics (Plausible or Umami – both cookie-less,
 * no consent banner needed). Enabled only when VITE_ANALYTICS_DOMAIN is set.
 *
 *   VITE_ANALYTICS_DOMAIN   e.g. app.allgrafika.pl  (Plausible "domain" / Umami ignores it)
 *   VITE_ANALYTICS_SRC      script URL, default https://plausible.io/js/script.js
 *   VITE_ANALYTICS_WEBSITE_ID  Umami website id (when using Umami)
 */
declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void
    umami?: { track: (event: string, data?: Record<string, string | number | boolean>) => void }
  }
}

const domain = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined
const src = (import.meta.env.VITE_ANALYTICS_SRC as string | undefined) || 'https://plausible.io/js/script.js'
const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined

export function initAnalytics() {
  if (!domain || typeof document === 'undefined') return
  if (document.querySelector('script[data-analytics]')) return
  // Standard Plausible queue stub – events fired before the script loads are replayed, not dropped.
  const w = window as any
  if (!w.plausible) {
    w.plausible = function (...args: unknown[]) {
      ;(w.plausible.q = w.plausible.q || []).push(args)
    }
  }
  const script = document.createElement('script')
  script.defer = true
  script.src = src
  script.setAttribute('data-analytics', '1')
  script.setAttribute('data-domain', domain)
  if (websiteId) script.setAttribute('data-website-id', websiteId)
  document.head.appendChild(script)
}

/** Funnel events: register, upload, generation_start, purchase, demo_start ... */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (!domain) return
  try {
    if (window.plausible) window.plausible(event, props ? { props } : undefined)
    else if (window.umami) window.umami.track(event, props)
  } catch {
    // analytics must never break the app
  }
}
