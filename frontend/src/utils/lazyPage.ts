import { lazy, type ComponentType } from 'react'

const RELOAD_FLAG = 'allgrafika:chunk-reload'

/**
 * React.lazy for route screens (spec 17, AC-PERF-003) that survives a deploy: after Vercel publishes
 * a new build the old chunk files are gone, so an open tab fails to import the next screen. The first
 * failure reloads the page once (fresh index.html → new chunk names); a second failure in the same
 * session is a real error and goes to the error boundary.
 */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load()
      safeSession(() => sessionStorage.removeItem(RELOAD_FLAG))
      return mod
    } catch (error) {
      const alreadyReloaded = safeSession(() => sessionStorage.getItem(RELOAD_FLAG)) === '1'
      if (!alreadyReloaded) {
        safeSession(() => sessionStorage.setItem(RELOAD_FLAG, '1'))
        window.location.reload()
        return new Promise<{ default: T }>(() => {}) // keep the fallback until the reload happens
      }
      throw error
    }
  })
}

function safeSession<R>(fn: () => R): R | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}
