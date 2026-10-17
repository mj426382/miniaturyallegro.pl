import { useEffect } from 'react'

const EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'keydown'] as const

/**
 * Spec 17 (AC-PERF-006/007): the screen's dialogs are not part of its first load – their chunks are fetched on the
 * user's first interaction (pointer, touch or key), well before a dialog can be opened, so it then opens instantly.
 */
export function usePreloadOnInteraction(...preloads: Array<() => void>) {
  useEffect(() => {
    let done = false
    const run = () => {
      if (done) return
      done = true
      remove()
      for (const preload of preloads) preload()
    }
    const remove = () => EVENTS.forEach((type) => window.removeEventListener(type, run, true))
    EVENTS.forEach((type) => window.addEventListener(type, run, { capture: true, passive: true }))
    return remove
    // The preloaders are module-level functions – registering once per screen is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
