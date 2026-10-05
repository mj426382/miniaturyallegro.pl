import { useEffect, useState } from 'react'
import { getCachedLegal, loadLegal, type LegalDoc } from '../data/legalLoader'

/** Renders a legal document from its lazily loaded chunk (already in the cache when hydrating). */
export default function LegalDocument({ doc }: { doc: LegalDoc }) {
  const [Content, setContent] = useState(() => getCachedLegal(doc))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (Content) return
    let active = true
    loadLegal(doc)
      .then((component) => active && setContent(() => component))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [Content, doc])

  if (Content) return <Content />
  if (failed) {
    return (
      <p role="alert" className="text-gray-700">
        Nie udało się wczytać dokumentu.{' '}
        <button type="button" onClick={() => window.location.reload()} className="underline text-blue-600">
          Odśwież stronę
        </button>
      </p>
    )
  }
  return <p className="text-gray-500">Wczytywanie dokumentu…</p>
}
