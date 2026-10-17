import { useCallback, useEffect, useState } from 'react'
import { platformsApi, PlatformPreset } from '../services/api'

/** Spec 08: presets come from the API (single source of truth) and are fetched once per session. */
let cache: Promise<PlatformPreset[]> | null = null

function loadPresets(): Promise<PlatformPreset[]> {
  if (!cache) {
    cache = platformsApi.list().then(({ data }) => data)
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

export function usePlatformPresets() {
  const [presets, setPresets] = useState<PlatformPreset[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    loadPresets()
      .then((data) => !cancelled && setPresets(data))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { presets, failed, retry }
}
