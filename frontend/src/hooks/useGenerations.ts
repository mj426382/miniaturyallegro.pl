import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { imagesApi, generationApi, GenerationStyleInfo } from '../services/api'
import { missingUniversalStyleIds } from '../utils/styles'

export interface Generation {
  id: string
  style: string
  status: string
  url: string | null
  rating?: number | null
}

export interface ImageDetails {
  id: string
  filename: string
  originalUrl: string
  createdAt?: string
  generations: Generation[]
}

export const isActiveGeneration = (g: Generation) => g.status === 'PENDING' || g.status === 'PROCESSING'

const POLL_INTERVAL_MS = 4000
/** Stop polling after this long – a generation stuck beyond it is handled server-side (refund). */
const POLL_MAX_MS = 15 * 60 * 1000

/** Outcome of the graphics that were in progress when a batch finished. */
export interface BatchSummary {
  completed: number
  failed: number
}

interface Options {
  /** A batch that was in progress has finished (success or failure). */
  onBatchFinished?: (summary: BatchSummary) => void
}

/**
 * Server state of one photo: the image, its generations, the style catalogue and the selection.
 * Polls while anything is in progress (one loop, capped at 15 minutes) and merges server rows
 * into the local list without dropping optimistic placeholders.
 */
export function useGenerations(imageId: string | undefined, options: Options = {}) {
  const [image, setImage] = useState<ImageDetails | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [styles, setStyles] = useState<GenerationStyleInfo[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /** Spec 11 rule 4: a failed load is not "not found" – the generator offers a retry instead. */
  const [loadError, setLoadError] = useState<'not-found' | 'failed' | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  /** True when the photo already had results when the page opened (picker starts collapsed). */
  const [openedWithResults, setOpenedWithResults] = useState(false)
  const wasActiveRef = useRef(false)
  /** Ids seen in progress since the batch started – the finish message counts only these. */
  const batchIdsRef = useRef(new Set<string>())
  const callbacksRef = useRef(options)
  callbacksRef.current = options

  const styleNames = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s.name])) as Record<string, string>, [styles])
  const generatedStyleIds = useMemo(() => new Set(generations.filter((g) => g.status !== 'FAILED').map((g) => g.style)), [generations])
  const hasActive = generations.some(isActiveGeneration)
  const completedCount = generations.filter((g) => g.status === 'COMPLETED').length
  const hasResults = generations.length > 0

  const mergeGenerations = useCallback((prev: Generation[], serverData: Generation[]): Generation[] => {
    const serverMap = new Map(serverData.map((g) => [g.id, g]))
    const prevIds = new Set(prev.map((g) => g.id))
    const updated = prev.map((g) => serverMap.get(g.id) ?? g)
    const fresh = serverData.filter((g) => !prevIds.has(g.id))
    return [...updated, ...fresh]
  }, [])

  const refreshGenerations = useCallback(async () => {
    if (!imageId) return
    try {
      const { data } = await generationApi.getResults(imageId)
      setGenerations((prev) => mergeGenerations(prev, data))
    } catch {
      // ignore transient polling errors
    }
  }, [imageId, mergeGenerations])

  // Initial load: image + generations + style catalogue.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [imageRes, stylesRes] = await Promise.all([imagesApi.getById(imageId!), generationApi.getStyles()])
        if (cancelled) return
        const existing: Generation[] = imageRes.data.generations || []
        setImage(imageRes.data)
        setGenerations(existing)
        setStyles(stylesRes.data.styles)
        // Returning to a photo with results: offer the styles that are still missing; a fresh photo
        // starts with the starter batch.
        const already = new Set(existing.filter((g) => g.status !== 'FAILED').map((g) => g.style))
        setSelectedStyles(existing.length ? missingUniversalStyleIds(stylesRes.data.styles, already) : stylesRes.data.defaultStyleIds)
        setOpenedWithResults(existing.length > 0)
      } catch (err: any) {
        if (cancelled) return
        const status = err?.response?.status
        setLoadError(status === 404 || status === 403 ? 'not-found' : 'failed')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [imageId, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    for (const g of generations) if (isActiveGeneration(g)) batchIdsRef.current.add(g.id)
  }, [generations])

  // Single polling loop – runs only while something is in progress, with a hard time cap.
  useEffect(() => {
    if (!hasActive || pollTimedOut) {
      if (wasActiveRef.current) {
        wasActiveRef.current = false
        if (!pollTimedOut) {
          // Preselect only the styles that have not been generated yet – once, on completion.
          setSelectedStyles(missingUniversalStyleIds(styles, generatedStyleIds))
          const batch = generations.filter((g) => batchIdsRef.current.has(g.id))
          batchIdsRef.current = new Set()
          callbacksRef.current.onBatchFinished?.({
            completed: batch.filter((g) => g.status === 'COMPLETED').length,
            failed: batch.filter((g) => g.status === 'FAILED').length,
          })
        }
      }
      return
    }
    wasActiveRef.current = true
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      if (Date.now() - startedAt > POLL_MAX_MS) {
        setPollTimedOut(true)
        toast.error('Generowanie trwa dłużej niż zwykle. Odśwież stronę za chwilę – kredyty za nieudane grafiki wracają automatycznie.', { duration: 8000 })
        return
      }
      refreshGenerations()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActive, pollTimedOut, refreshGenerations])

  /** A new batch after the polling cap was hit must be followed again (otherwise it never updates). */
  const restartPolling = useCallback(() => setPollTimedOut(false), [])

  const toggleStyle = useCallback((id: string) => {
    setSelectedStyles((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }, [])

  return {
    image,
    generations,
    setGenerations,
    styles,
    styleNames,
    generatedStyleIds,
    selectedStyles,
    setSelectedStyles,
    toggleStyle,
    restartPolling,
    isLoading,
    loadError,
    reload,
    pollTimedOut,
    hasActive,
    completedCount,
    hasResults,
    openedWithResults,
  }
}
