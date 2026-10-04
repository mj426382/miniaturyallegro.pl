/**
 * Spec 15: browser-side queue that writes offer descriptions for many photos.
 * Pure (API and timers injected) so every branch is unit-tested.
 */
export type BulkStatus = 'queued' | 'waiting-graphic' | 'writing' | 'done' | 'skipped' | 'error'

export interface BulkUpdate {
  status: BulkStatus
  message?: string
}

export interface BulkDeps {
  /** Current description state of the photo. */
  getView: (imageId: string) => Promise<{ hasDescription: boolean; canCreate: boolean }>
  /** Statuses of the photo's generations (PENDING / PROCESSING / COMPLETED / FAILED). */
  getGenerationStatuses: (imageId: string) => Promise<string[]>
  create: (imageId: string, notes?: string) => Promise<void>
  sleep: (ms: number) => Promise<void>
}

export interface BulkOptions {
  concurrency?: number
  pollMs?: number
  maxWaitMs?: number
  rateLimitDelayMs?: number
  maxRateLimitRetries?: number
  isCancelled?: () => boolean
}

const ACTIVE = new Set(['PENDING', 'PROCESSING'])

function serverMessage(err: any, fallback: string): string {
  const message = err?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : message || fallback
}

async function processOne(imageId: string, notes: string | undefined, deps: BulkDeps, opts: Required<BulkOptions>, update: (u: BulkUpdate) => void) {
  const view = await deps.getView(imageId)
  if (view.hasDescription) return update({ status: 'skipped', message: 'ma już opis' })

  if (!view.canCreate) {
    let waited = 0
    for (;;) {
      const statuses = await deps.getGenerationStatuses(imageId)
      if (statuses.includes('COMPLETED')) break
      if (!statuses.some((s) => ACTIVE.has(s))) return update({ status: 'error', message: 'brak gotowej grafiki' })
      if (waited >= opts.maxWaitMs) return update({ status: 'error', message: 'grafiki generują się zbyt długo – spróbuj później' })
      update({ status: 'waiting-graphic' })
      await deps.sleep(opts.pollMs)
      waited += opts.pollMs
    }
  }

  update({ status: 'writing' })
  let rateLimited = 0
  let modelRetried = false
  for (;;) {
    try {
      await deps.create(imageId, notes)
      return update({ status: 'done' })
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 429 && rateLimited < opts.maxRateLimitRetries) {
        rateLimited++
        update({ status: 'writing', message: 'czekam na wolne miejsce w kolejce…' })
        await deps.sleep(opts.rateLimitDelayMs)
        continue
      }
      if (status === 503 && !modelRetried) {
        modelRetried = true
        await deps.sleep(5000)
        continue
      }
      return update({ status: 'error', message: serverMessage(err, 'nie udało się napisać opisu') })
    }
  }
}

/** Runs the queue; resolves when every photo has a final status. */
export async function runBulkDescriptions(imageIds: string[], notes: string | undefined, deps: BulkDeps, onUpdate: (imageId: string, update: BulkUpdate) => void, options: BulkOptions = {}) {
  const opts: Required<BulkOptions> = {
    concurrency: options.concurrency ?? 2,
    pollMs: options.pollMs ?? 5000,
    maxWaitMs: options.maxWaitMs ?? 10 * 60 * 1000,
    rateLimitDelayMs: options.rateLimitDelayMs ?? 20_000,
    maxRateLimitRetries: options.maxRateLimitRetries ?? 6,
    isCancelled: options.isCancelled ?? (() => false),
  }
  const trimmedNotes = notes?.trim() || undefined
  let next = 0
  const worker = async () => {
    while (next < imageIds.length) {
      const imageId = imageIds[next++]
      if (opts.isCancelled()) {
        onUpdate(imageId, { status: 'skipped', message: 'przerwano' })
        continue
      }
      try {
        await processOne(imageId, trimmedNotes, deps, opts, (u) => onUpdate(imageId, u))
      } catch (err) {
        onUpdate(imageId, { status: 'error', message: serverMessage(err, 'błąd połączenia') })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, imageIds.length) }, worker))
}
