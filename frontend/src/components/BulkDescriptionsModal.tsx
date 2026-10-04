import { useEffect, useRef, useState } from 'react'
import { XMarkIcon, DocumentTextIcon, CheckCircleIcon, ExclamationCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline'
import { descriptionsApi, generationApi } from '../services/api'
import { track } from '../services/analytics'
import { BulkStatus, runBulkDescriptions } from '../utils/bulkDescriptions'

export interface BulkPhoto {
  id: string
  label: string
}

interface Props {
  photos: BulkPhoto[]
  onClose: () => void
  /** Called once the queue finished (to refresh lists). */
  onFinished?: () => void
}

const STATUS_LABEL: Record<BulkStatus, string> = {
  queued: 'czeka',
  'waiting-graphic': 'czeka na grafikę',
  writing: 'piszę opis…',
  done: 'gotowe',
  skipped: 'pominięte',
  error: 'błąd',
}

const MAX_NOTES = 2000

/** Spec 15: writes the free first description for many photos with visible progress. */
export default function BulkDescriptionsModal({ photos, onClose, onFinished }: Props) {
  const [notes, setNotes] = useState('')
  const [phase, setPhase] = useState<'setup' | 'running' | 'finished'>('setup')
  const [items, setItems] = useState<Record<string, { status: BulkStatus; message?: string }>>(() => Object.fromEntries(photos.map((p) => [p.id, { status: 'queued' as BulkStatus }])))
  const cancelled = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'running' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const start = async () => {
    setPhase('running')
    cancelled.current = false
    await runBulkDescriptions(
      photos.map((p) => p.id),
      notes,
      {
        getView: async (id) => {
          const { data } = await descriptionsApi.get(id)
          return { hasDescription: Boolean(data.description), canCreate: data.canCreate }
        },
        getGenerationStatuses: async (id) => {
          const { data } = await generationApi.getResults(id)
          return (data as Array<{ status: string }>).map((g) => g.status)
        },
        create: async (id, sharedNotes) => {
          await descriptionsApi.create(id, sharedNotes)
        },
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      },
      (id, update) => setItems((prev) => ({ ...prev, [id]: update })),
      { isCancelled: () => cancelled.current },
    )
    setPhase('finished')
    track('bulk_descriptions', { photos: photos.length })
    onFinished?.()
  }

  const values = Object.values(items)
  const count = (s: BulkStatus) => values.filter((v) => v.status === s).length
  const finishedCount = count('done') + count('skipped') + count('error')
  const progress = photos.length ? Math.round((finishedCount / photos.length) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={() => phase !== 'running' && onClose()} className="absolute inset-0 w-full h-full cursor-default" />
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-descriptions-title" className="relative bg-white rounded-2xl w-full max-w-xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 id="bulk-descriptions-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-blue-600" /> Opisy dla zaznaczonych ({photos.length})
          </h2>
          <button ref={closeRef} onClick={onClose} disabled={phase === 'running'} aria-label="Zamknij" className="text-gray-500 hover:text-gray-700 disabled:opacity-30">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {phase === 'setup' && (
          <>
            <p className="text-sm text-gray-600 mb-3">Pierwszy opis każdego zdjęcia jest gratis. Zdjęcia z opisem pominiemy, a na trwające generowanie grafik poczekamy.</p>
            <label htmlFor="bulk-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Wspólne informacje <span className="text-gray-500 font-normal">(opcjonalnie)</span>
            </label>
            <textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={MAX_NOTES}
              rows={3}
              placeholder="np. marka, gwarancja 24 miesiące, wysyłka w 24 h"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="help-text mt-1">Wpisz tylko to, co dotyczy wszystkich produktów – trafi do każdego opisu.</p>
            <button onClick={start} className="btn-primary mt-4">
              Napisz opisy
            </button>
          </>
        )}

        {phase !== 'setup' && (
          <>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Postęp pisania opisów">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg" aria-live="polite">
              {photos.map((p) => {
                const item = items[p.id]
                return (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {item.status === 'done' ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-600 shrink-0" />
                    ) : item.status === 'error' ? (
                      <ExclamationCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
                    ) : item.status === 'skipped' ? (
                      <MinusCircleIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                    )}
                    <span className="flex-1 truncate text-gray-800">{p.label}</span>
                    <span className={`text-xs ${item.status === 'error' ? 'text-red-600' : 'text-gray-500'}`} data-testid={`bulk-status-${p.id}`}>
                      {STATUS_LABEL[item.status]}
                      {item.message ? ` – ${item.message}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
            {phase === 'running' ? (
              <button onClick={() => (cancelled.current = true)} className="btn-secondary mt-4">
                Przerwij
              </button>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700" role="status">
                  Gotowe: {count('done')}, pominięte: {count('skipped')}, błędy: {count('error')}
                </p>
                <button onClick={onClose} className="btn-primary">
                  Zamknij
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
