import * as Sentry from '@sentry/react'

let enabled = false

/** Error reporting is opt-in via VITE_SENTRY_DSN; without it nothing leaves the browser. */
export function initErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return false
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    tracesSampleRate: 0,
  })
  enabled = true
  return true
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function setReportingUser(user: { id: string } | null) {
  if (!enabled) return
  Sentry.setUser(user ? { id: user.id } : null)
}
