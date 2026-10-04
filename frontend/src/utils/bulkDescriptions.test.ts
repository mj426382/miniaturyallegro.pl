import { describe, expect, it, vi } from 'vitest'
import { BulkDeps, BulkUpdate, runBulkDescriptions } from './bulkDescriptions'

function setup(overrides: Partial<BulkDeps> = {}) {
  const updates: Record<string, BulkUpdate[]> = {}
  const deps: BulkDeps = {
    getView: async () => ({ hasDescription: false, canCreate: true }),
    getGenerationStatuses: async () => ['COMPLETED'],
    create: vi.fn(async () => undefined),
    sleep: vi.fn(async () => undefined),
    ...overrides,
  }
  const onUpdate = (id: string, u: BulkUpdate) => (updates[id] ??= []).push(u)
  const last = (id: string) => updates[id]?.[updates[id].length - 1]
  return { deps, updates, onUpdate, last }
}

describe('runBulkDescriptions', () => {
  it('[AC-BAT-004] skips described photos, waits for running graphics, fails photos without any and passes shared notes', async () => {
    const generationPolls: Record<string, string[][]> = {
      running: [['PROCESSING'], ['PROCESSING', 'COMPLETED']],
      none: [['FAILED']],
    }
    const { deps, onUpdate, last, updates } = setup({
      getView: async (id) => ({ hasDescription: id === 'described', canCreate: id === 'ready' }),
      getGenerationStatuses: async (id) => generationPolls[id].shift() ?? [],
    })
    await runBulkDescriptions(['described', 'ready', 'running', 'none'], '  Marka X, gwarancja 2 lata  ', deps, onUpdate, { pollMs: 10 })

    expect(last('described')).toEqual({ status: 'skipped', message: 'ma już opis' })
    expect(last('ready')).toEqual({ status: 'done' })
    expect(updates.running.map((u) => u.status)).toEqual(['waiting-graphic', 'writing', 'done'])
    expect(last('none')).toEqual({ status: 'error', message: 'brak gotowej grafiki' })
    expect(deps.create).toHaveBeenCalledTimes(2)
    expect(deps.create).toHaveBeenCalledWith('ready', 'Marka X, gwarancja 2 lata')
    expect(deps.create).toHaveBeenCalledWith('running', 'Marka X, gwarancja 2 lata')
  })

  it('[AC-BAT-004] waits and retries on 429, retries a 503 once and reports other errors', async () => {
    const failures: Record<string, any[]> = {
      limited: [{ response: { status: 429 } }, { response: { status: 429 } }],
      flaky: [{ response: { status: 503 } }],
      broken: [{ response: { status: 503 } }, { response: { status: 503, data: { message: 'Model niedostępny' } } }],
    }
    const { deps, onUpdate, last } = setup({
      create: vi.fn(async (id: string) => {
        const err = failures[id]?.shift()
        if (err) throw err
      }),
    })
    await runBulkDescriptions(['limited', 'flaky', 'broken'], undefined, deps, onUpdate, { rateLimitDelayMs: 1 })
    expect(last('limited')).toEqual({ status: 'done' })
    expect(last('flaky')).toEqual({ status: 'done' })
    expect(last('broken')).toEqual({ status: 'error', message: 'Model niedostępny' })
    expect(deps.sleep).toHaveBeenCalledWith(1)
    expect(deps.create).toHaveBeenCalledWith('limited', undefined)
  })

  it('[AC-BAT-004] gives up waiting after the limit and stops starting new photos when cancelled', async () => {
    const { deps, onUpdate, last } = setup({
      getView: async () => ({ hasDescription: false, canCreate: false }),
      getGenerationStatuses: async () => ['PENDING'],
    })
    await runBulkDescriptions(['slow'], undefined, deps, onUpdate, { pollMs: 100, maxWaitMs: 300 })
    expect(last('slow')?.status).toBe('error')
    expect(last('slow')?.message).toContain('zbyt długo')

    let cancelled = false
    const second = setup({
      create: vi.fn(async () => {
        cancelled = true
      }),
    })
    await runBulkDescriptions(['a', 'b', 'c'], undefined, second.deps, second.onUpdate, { concurrency: 1, isCancelled: () => cancelled })
    expect(second.last('a')).toEqual({ status: 'done' })
    expect(second.last('b')).toEqual({ status: 'skipped', message: 'przerwano' })
    expect(second.last('c')).toEqual({ status: 'skipped', message: 'przerwano' })
  })

  it('never runs more than the configured number of requests at once', async () => {
    let inFlight = 0
    let peak = 0
    const { deps, onUpdate } = setup({
      create: vi.fn(async () => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
      }),
    })
    await runBulkDescriptions(['1', '2', '3', '4', '5'], undefined, deps, onUpdate, { concurrency: 2 })
    expect(peak).toBe(2)
    expect(deps.create).toHaveBeenCalledTimes(5)
  })
})
