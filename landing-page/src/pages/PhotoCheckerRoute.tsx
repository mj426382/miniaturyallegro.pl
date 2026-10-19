import { useEffect, useState, type ComponentType } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getCachedPhotoChecker, loadPhotoChecker } from '../data/photoCheckerLoader'

/**
 * Route element of the photo checker (spec 25). Renders the lazy page when its chunk is in memory (prerender, or the
 * pre-hydration preload in main.tsx); on client-side navigation it fetches the chunk first.
 */
export default function PhotoCheckerRoute() {
  const [Page, setPage] = useState<ComponentType | undefined>(() => getCachedPhotoChecker())
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (Page) return
    let cancelled = false
    loadPhotoChecker()
      .then((p) => {
        if (!cancelled) setPage(() => p)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [Page])

  if (Page) return <Page />
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16" aria-busy={!failed}>
        <p className="text-gray-700">{failed ? 'Nie udało się wczytać narzędzia. Odśwież stronę.' : 'Ładowanie narzędzia…'}</p>
      </main>
      <Footer />
    </div>
  )
}
