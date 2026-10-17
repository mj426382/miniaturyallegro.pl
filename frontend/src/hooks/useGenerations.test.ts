import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const api = vi.hoisted(() => ({
  results: [] as Array<{ id: string; style: string; status: string; url: string | null }>,
  getResults: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock('../services/api', () => ({
  imagesApi: {
    getById: async () => ({ data: { id: 'img-1', filename: 'a.jpg', originalUrl: '/a.jpg', generations: api.results.map((g) => ({ ...g })) } }),
  },
  generationApi: {
    getStyles: async () => ({ data: { styles: [], defaultStyleIds: [] } }),
    getResults: api.getResults,
  },
}))

import { useGenerations } from './useGenerations'

const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

describe('useGenerations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    api.results = [{ id: 'g1', style: 'white-bg', status: 'PENDING', url: null }]
    api.getResults.mockReset()
    api.getResults.mockImplementation(async () => ({ data: api.results.map((g) => ({ ...g })) }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('[AC-GEN-026] resumes polling for a new batch after the 15-minute cap and reports how the batch ended', async () => {
    const onBatchFinished = vi.fn()
    const { result } = renderHook(() => useGenerations('img-1', { onBatchFinished }))
    await flush()
    expect(result.current.hasActive).toBe(true)

    // The stuck graphic hits the client-side cap: polling stops.
    await advance(16 * 60 * 1000)
    expect(result.current.pollTimedOut).toBe(true)
    const callsAtCap = api.getResults.mock.calls.length
    await advance(60_000)
    expect(api.getResults.mock.calls.length).toBe(callsAtCap)

    // A new batch is started – it must be followed again.
    api.results = [
      { id: 'g1', style: 'white-bg', status: 'FAILED', url: null },
      { id: 'g2', style: 'dark-luxury', status: 'PENDING', url: null },
    ]
    act(() => {
      result.current.setGenerations((prev) => [...prev, { id: 'g2', style: 'dark-luxury', status: 'PENDING', url: null }])
      result.current.restartPolling()
    })
    await advance(4_000)
    expect(api.getResults.mock.calls.length).toBeGreaterThan(callsAtCap)

    // Both graphics of the batch fail: the summary says so (no "ready" message for nothing).
    api.results = api.results.map((g) => ({ ...g, status: 'FAILED' }))
    await advance(4_000)
    await flush()
    expect(onBatchFinished).toHaveBeenCalledWith({ completed: 0, failed: 2 })
  })
})
