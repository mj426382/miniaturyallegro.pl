import { lazy, type ComponentType } from 'react'

const RELOAD_FLAG = 'allgrafika:chunk-reload'

/**
 * React.lazy for route screens (spec 17, AC-PERF-003) that survives a deploy: after Vercel publishes
 * a new build the old chunk files are gone, so an open tab fails to import the next screen. The first
 * failure reloads the page once (fresh index.html → new chunk names); a second failure in the same
 * session is a real error and goes to the error boundary.
 */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
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

/**
 * Spec 17 (AC-PERF-006/007): a lazily loaded dialog. `preload()` fetches its chunk ahead of the first open (on the
 * user's first interaction with the screen), so the dialog opens instantly – also without network – afterwards.
 * A failed preload is forgotten, so opening the dialog tries again (and reloads once after a deploy, like screens).
 */
export function lazyModal<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  let pending: Promise<{ default: T }> | null = null
  const loadOnce = () => {
    if (!pending) {
      pending = load()
      pending.catch(() => {
        pending = null
      })
    }
    return pending
  }
  return Object.assign(lazyPage(loadOnce), {
    preload: () => {
      loadOnce().catch(() => undefined)
    },
  })
}

function safeSession<R>(fn: () => R): R | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}
